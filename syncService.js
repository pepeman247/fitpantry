/**
 * FitPantry - Offline-First Sync Service
 * Persistencia en tiempo real con IndexedDB + Cloud Firestore
 * Sincronización transparente para entrenar en sótanos sin conexión
 */

(function (window) {
  'use strict';

  const DB_NAME = 'fitpantry_offline_engine_v1';
  const DB_VERSION = 1;
  const QUEUE_STORE = 'sync_queue';

  let idbPromise = null;
  let isSyncing = false;
  let listeners = [];

  // ============================================================================
  // 1. INDEXEDDB WRAPPER
  // ============================================================================

  function openDatabase() {
    if (idbPromise) return idbPromise;

    idbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('[SyncService] IndexedDB no soportado en este navegador. Modo fallback.');
        return resolve(null);
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('by_table', 'table', { unique: false });
          store.createIndex('by_status', 'status', { unique: false });
          store.createIndex('by_client_key', 'client_log_key', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error('[SyncService] Error abriendo IndexedDB:', event.target.error);
        resolve(null);
      };
    });

    return idbPromise;
  }

  async function enqueueOperation(table, action, payload, client_log_key = null) {
    const db = await openDatabase();
    const entry = {
      table,
      action,
      payload,
      client_log_key,
      status: 'pending',
      attempts: 0,
      timestamp: Date.now()
    };

    if (!db) {
      // Fallback a localStorage si IndexedDB no está disponible
      try {
        const queue = JSON.parse(localStorage.getItem('fitpantry_fallback_queue') || '[]');
        entry.id = Date.now() + Math.random();
        queue.push(entry);
        localStorage.setItem('fitpantry_fallback_queue', JSON.stringify(queue));
      } catch (e) {
        console.error('[SyncService] Fallback localStorage error:', e);
      }
      notifyStatus();
      return;
    }

    return new Promise((resolve) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.add(entry);
      req.onsuccess = () => {
        notifyStatus();
        resolve(req.result);
      };
      req.onerror = () => {
        console.error('[SyncService] Error encolando operación:', req.error);
        resolve(null);
      };
    });
  }

  async function getPendingQueue() {
    const db = await openDatabase();
    if (!db) {
      try {
        return JSON.parse(localStorage.getItem('fitpantry_fallback_queue') || '[]');
      } catch (e) {
        return [];
      }
    }

    return new Promise((resolve) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async function removeQueueItem(id) {
    const db = await openDatabase();
    if (!db) {
      try {
        let queue = JSON.parse(localStorage.getItem('fitpantry_fallback_queue') || '[]');
        queue = queue.filter(item => item.id !== id);
        localStorage.setItem('fitpantry_fallback_queue', JSON.stringify(queue));
      } catch (e) {}
      notifyStatus();
      return;
    }

    return new Promise((resolve) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.delete(id);
      req.onsuccess = () => {
        notifyStatus();
        resolve(true);
      };
      req.onerror = () => resolve(false);
    });
  }

  // ============================================================================
  // 2. STATUS REPORTING & LISTENERS
  // ============================================================================

  function onSyncStatusChange(cb) {
    if (typeof cb === 'function') listeners.push(cb);
  }

  async function getSyncStatus() {
    const queue = await getPendingQueue();
    const isOnline = navigator.onLine;
    const isConfigured = window.FirebaseAuth && window.FirebaseAuth.isConfigured();
    const user = window.FirebaseAuth ? await window.FirebaseAuth.getUser() : null;

    let state = 'synced';
    if (!isConfigured) {
      state = 'unconfigured';
    } else if (!user) {
      state = 'guest';
    } else if (!isOnline) {
      state = queue.length > 0 ? 'pending_offline' : 'offline';
    } else if (isSyncing) {
      state = 'syncing';
    } else if (queue.length > 0) {
      state = 'pending';
    }

    return {
      state,
      pendingCount: queue.length,
      isOnline,
      user
    };
  }

  async function notifyStatus() {
    const status = await getSyncStatus();
    listeners.forEach(cb => {
      try {
        cb(status);
      } catch (e) {
        console.error('[SyncService] Listener error:', e);
      }
    });
  }

  // ============================================================================
  // 3. CLOUD SYNC ENGINE (DRAIN QUEUE TO CLOUD FIRESTORE)
  // ============================================================================

  async function drainQueue() {
    if (isSyncing) return;
    if (!navigator.onLine) {
      notifyStatus();
      return;
    }

    if (!window.FirebaseAuth || !window.FirebaseAuth.isConfigured()) {
      notifyStatus();
      return;
    }

    const db = window.FirebaseAuth.getDb();
    const user = await window.FirebaseAuth.getUser();
    if (!db || !user) {
      notifyStatus();
      return;
    }

    const queue = await getPendingQueue();
    if (queue.length === 0) {
      notifyStatus();
      return;
    }

    isSyncing = true;
    notifyStatus();

    try {
      for (const item of queue) {
        const payload = {
          ...item.payload,
          user_id: user.uid,
          updated_at: new Date().toISOString()
        };

        let docId = '';
        if (item.table === 'workout_logs') {
          docId = item.client_log_key || `${payload.ejercicio_id}_s${payload.serie_numero}_${payload.fecha}`;
        } else if (item.table === 'nutrition_logs') {
          docId = item.client_log_key || `${payload.meal_id}_${payload.fecha}`;
        } else if (item.table === 'pantry_items') {
          docId = item.client_log_key || payload.item_key;
        }

        try {
          await db.collection('users').doc(user.uid).collection(item.table).doc(docId).set(payload, { merge: true });
          await removeQueueItem(item.id);
        } catch (error) {
          console.warn(`[SyncService] Fallo al sincronizar elemento de ${item.table} con Firestore:`, error.message);
          if (error.message.includes('network') || error.code === 'unavailable') {
            break; // Detener drenado si la red falló
          }
          if (item.attempts >= 3) {
            console.error('[SyncService] Descartando elemento tras 3 fallos:', item);
            await removeQueueItem(item.id);
          }
        }
      }
    } catch (e) {
      console.error('[SyncService] Error general en drainQueue:', e);
    } finally {
      isSyncing = false;
      notifyStatus();
    }
  }

  // ============================================================================
  // 4. PUBLIC QUEUE API (CALLED FROM APP.JS)
  // ============================================================================

  function getTodayDateStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function syncWorkoutSet(setLog) {
    const payload = {
      fecha: setLog.fecha || getTodayDateStr(),
      semana_mesociclo: setLog.semana || 1,
      sesion_nombre: setLog.dia || 'Sesion',
      ejercicio_id: setLog.ejercicioId,
      ejercicio_nombre: setLog.ejercicioNombre,
      serie_numero: setLog.setIndex,
      peso_kg: parseFloat(setLog.weight) || 0,
      repeticiones: parseInt(setLog.reps, 10) || 0,
      rir_real: String(setLog.rir !== undefined ? setLog.rir : ''),
      tempo_cumplido: setLog.tempo_cumplido !== undefined ? !!setLog.tempo_cumplido : true,
      molestia_dolor: !!setLog.molestia_dolor,
      notas: setLog.notas || '',
      completada: !!setLog.completed,
      client_log_key: setLog.clientLogKey,
      updated_at: new Date().toISOString()
    };

    await enqueueOperation('workout_logs', 'upsert', payload, setLog.clientLogKey);

    // Intentar sincronizar inmediatamente en segundo plano si hay red
    if (navigator.onLine) {
      drainQueue();
    }
  }

  async function syncNutritionMeal(mealLog) {
    const payload = {
      fecha: mealLog.fecha || getTodayDateStr(),
      meal_id: mealLog.mealId,
      comida_tipo: mealLog.comidaTipo || 'Comida',
      plato_nombre: mealLog.platoNombre || '',
      completada: !!mealLog.completed,
      adherencia_100_sin_gluten: mealLog.sinGluten !== undefined ? !!mealLog.sinGluten : true,
      notas_desviacion: mealLog.notas || '',
      updated_at: new Date().toISOString()
    };

    await enqueueOperation('nutrition_logs', 'upsert', payload, mealLog.mealId);

    if (navigator.onLine) {
      drainQueue();
    }
  }

  async function syncPantryItem(item) {
    const payload = {
      item_key: item.id,
      producto: item.producto || item.nombre || 'Producto',
      categoria: item.categoria || 'General',
      en_casa: item.status === 'athome',
      cantidad: item.cantidad || '',
      updated_at: new Date().toISOString()
    };

    await enqueueOperation('pantry_items', 'upsert', payload, item.id);

    if (navigator.onLine) {
      drainQueue();
    }
  }

  // ============================================================================
  // 5. HYDRATION FROM CLOUD (PULL REMOTE USER DATA ON LOGIN)
  // ============================================================================

  async function pullFromCloud(targetState) {
    if (!window.FirebaseAuth || !window.FirebaseAuth.isConfigured()) return false;
    const db = window.FirebaseAuth.getDb();
    if (!db) return false;

    const user = await window.FirebaseAuth.getUser();
    if (!user) return false;

    try {
      // Obtener elementos aún pendientes en cola para no sobreescribir datos locales más recientes
      const pendingQueue = await getPendingQueue();
      const pendingWorkoutKeys = new Set(
        pendingQueue.filter(p => p.table === 'workout_logs').map(p => p.client_log_key).filter(Boolean)
      );
      const pendingMealKeys = new Set(
        pendingQueue.filter(p => p.table === 'nutrition_logs').map(p => p.client_log_key || (p.payload && p.payload.meal_id)).filter(Boolean)
      );
      const pendingPantryKeys = new Set(
        pendingQueue.filter(p => p.table === 'pantry_items').map(p => p.client_log_key || (p.payload && p.payload.item_key)).filter(Boolean)
      );

      // 1. Obtener registros de entrenamiento desde Firestore
      const workoutSnap = await db.collection('users').doc(user.uid).collection('workout_logs').get();
      if (!workoutSnap.empty) {
        workoutSnap.forEach(doc => {
          const row = doc.data();
          const key = row.client_log_key || doc.id;
          if (pendingWorkoutKeys.has(key)) return; // Preservar cambio local no sincronizado
          targetState.workoutLogs[key] = {
            weight: row.peso_kg,
            reps: row.repeticiones,
            rir: row.rir_real,
            completed: !!row.completada,
            tempo_cumplido: !!row.tempo_cumplido,
            molestia_dolor: !!row.molestia_dolor,
            notas: row.notas || ''
          };
        });
      }

      // 2. Obtener registros de nutrición desde Firestore
      const nutriSnap = await db.collection('users').doc(user.uid).collection('nutrition_logs').get();
      if (!nutriSnap.empty) {
        nutriSnap.forEach(doc => {
          const row = doc.data();
          const mealId = row.meal_id || doc.id;
          if (pendingMealKeys.has(mealId)) return;
          targetState.nutritionLogs[mealId] = !!row.completada;
        });
      }

      // 3. Obtener estado de despensa desde Firestore
      const pantrySnap = await db.collection('users').doc(user.uid).collection('pantry_items').get();
      if (!pantrySnap.empty) {
        pantrySnap.forEach(doc => {
          const row = doc.data();
          const itemKey = row.item_key || doc.id;
          if (pendingPantryKeys.has(itemKey)) return;
          const existing = targetState.pantryItems.find(p => p.id === itemKey);
          if (existing) {
            existing.status = row.en_casa ? 'athome' : 'tobuy';
            if (row.cantidad) existing.cantidad = row.cantidad;
          }
        });
      }

      notifyStatus();
      return true;
    } catch (e) {
      console.error('[SyncService] Error hidratando desde Cloud Firestore:', e);
      return false;
    }
  }

  // ============================================================================
  // 6. AUTO-SYNC LISTENERS
  // ============================================================================

  window.addEventListener('online', () => {
    console.log('[SyncService] Conexión de red recuperada. Iniciando sincronización...');
    drainQueue();
  });

  window.addEventListener('offline', () => {
    console.log('[SyncService] Modo sin conexión activado (sótano del gimnasio).');
    notifyStatus();
  });

  // Chequeo periódico cada 30 segundos
  setInterval(() => {
    if (navigator.onLine) {
      drainQueue();
    }
  }, 30000);

  // Inicialización de base de datos
  openDatabase().then(() => notifyStatus());

  window.SyncService = {
    syncWorkoutSet,
    syncNutritionMeal,
    syncPantryItem,
    drainQueue,
    pullFromCloud,
    getSyncStatus,
    onSyncStatusChange,
    getPendingQueue
  };

})(window);
