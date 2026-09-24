/**
 * FitPantry (Él) - Firebase Client Module
 * Autenticación robusta y persistencia Cloud con Cloud Firestore & Firebase Auth v10 Compat
 * Opción A: Credenciales en localStorage del dispositivo (0 claves en GitHub)
 */

(function (window) {
  'use strict';

  const STORAGE_CONFIG_KEY = 'fitpantry_firebase_config';

  let firebaseApp = null;
  let firestoreDb = null;
  let persistenceInitialized = false;

  function getFirebaseConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.apiKey && parsed.projectId) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[FirebaseClient] Error leyendo configuración de localStorage:', e);
    }

    if (window.FIT_FIREBASE_CONFIG && window.FIT_FIREBASE_CONFIG.apiKey) {
      return window.FIT_FIREBASE_CONFIG;
    }

    return null;
  }

  async function saveFirebaseConfig(config) {
    try {
      if (!config || !config.apiKey || !config.projectId) {
        throw new Error('Configuración incompleta: se requiere al menos apiKey y projectId.');
      }
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
      // Si ya existía una app inicializada, limpiarla
      if (window.firebase && window.firebase.apps && window.firebase.apps.length) {
        try {
          await Promise.all(window.firebase.apps.map(a => a.delete()));
        } catch (e) {
          console.warn('[FirebaseClient] Error limpiando app previa:', e);
        }
      }
      firebaseApp = null;
      firestoreDb = null;
      persistenceInitialized = false;
      initFirebase();
      return true;
    } catch (e) {
      console.error('[FirebaseClient] Error guardando credenciales:', e);
      return false;
    }
  }

  function isConfigured() {
    const config = getFirebaseConfig();
    return !!(
      config &&
      config.apiKey &&
      config.projectId &&
      !config.apiKey.includes('tu-api-key')
    );
  }

  function initFirebase() {
    if (firebaseApp && firestoreDb) {
      return { app: firebaseApp, db: firestoreDb, auth: firebase.auth(firebaseApp) };
    }

    if (!window.firebase || typeof window.firebase.initializeApp !== 'function') {
      console.warn('[FirebaseClient] SDK de Firebase no está cargado en window.firebase.');
      return null;
    }

    const config = getFirebaseConfig();
    if (!config) return null;

    try {
      if (!firebase.apps.length) {
        firebaseApp = firebase.initializeApp(config);
      } else {
        firebaseApp = firebase.apps[0];
      }

      firestoreDb = firebase.firestore(firebaseApp);

      // Activar persistencia offline nativa de Firestore si no se ha hecho
      if (!persistenceInitialized) {
        persistenceInitialized = true;
        firestoreDb.enablePersistence({ synchronizeTabs: true }).catch((err) => {
          if (err.code === 'failed-precondition') {
            console.warn('[FirebaseClient] Múltiples pestañas abiertas, persistencia activa en pestaña principal.');
          } else if (err.code === 'unimplemented') {
            console.warn('[FirebaseClient] El navegador no soporta persistencia offline nativa de Firestore.');
          }
        });
      }

      return { app: firebaseApp, db: firestoreDb, auth: firebase.auth(firebaseApp) };
    } catch (err) {
      console.error('[FirebaseClient] Error inicializando Firebase:', err);
      return null;
    }
  }

  const FirebaseAuth = {
    isConfigured,
    getFirebaseConfig,
    saveFirebaseConfig,

    getDb() {
      const fb = initFirebase();
      return fb ? fb.db : null;
    },

    getAuth() {
      const fb = initFirebase();
      return fb ? fb.auth : null;
    },

    async signUp(email, password, nombre = '') {
      const fb = initFirebase();
      if (!fb) throw new Error('Firebase no está configurado. Introduce tus credenciales en Ajustes.');

      const userCredential = await fb.auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      if (nombre && user.updateProfile) {
        try {
          await user.updateProfile({ displayName: nombre });
        } catch (e) {}
      }

      // Guardar perfil inicial en Firestore
      try {
        await fb.db.collection('users').doc(user.uid).set({
          rol_perfil: 'hombre',
          nombre: nombre || email.split('@')[0],
          email: email,
          created_at: firebase.firestore.FieldValue.serverTimestamp(),
          updated_at: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.warn('[FirebaseClient] Perfil inicial guardado en auth:', err);
      }

      return user;
    },

    async signIn(email, password) {
      const fb = initFirebase();
      if (!fb) throw new Error('Firebase no está configurado. Introduce tus credenciales en Ajustes.');

      const userCredential = await fb.auth.signInWithEmailAndPassword(email, password);
      return userCredential.user;
    },

    async signOut() {
      const fb = initFirebase();
      if (!fb) return;
      await fb.auth.signOut();
    },

    async resetPassword(email) {
      const fb = initFirebase();
      if (!fb) throw new Error('Firebase no está configurado.');
      await fb.auth.sendPasswordResetEmail(email);
    },

    getUser() {
      const fb = initFirebase();
      if (!fb) return Promise.resolve(null);

      return new Promise((resolve) => {
        const unsubscribe = fb.auth.onAuthStateChanged((user) => {
          unsubscribe();
          resolve(user);
        });
      });
    },

    onAuthStateChange(callback) {
      const fb = initFirebase();
      if (!fb) return () => {};
      return fb.auth.onAuthStateChanged((user) => {
        if (typeof callback === 'function') {
          callback(user);
        }
      });
    }
  };

  window.FirebaseAuth = FirebaseAuth;
})(window);
