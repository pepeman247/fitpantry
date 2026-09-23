/**
 * FitPantry (Él) - Supabase Client Module
 * Autenticación robusta, gestión de sesiones y persistencia Cloud con Supabase JS SDK v2
 */

(function (window) {
  'use strict';

  // Configuración predeterminada (Reemplazar con tus credenciales de Supabase o configurarlas desde la pestaña Ajustes)
  const DEFAULT_SUPABASE_URL = 'https://tu-proyecto.supabase.co';
  const DEFAULT_SUPABASE_ANON_KEY = 'tu-anon-key-aqui';

  const STORAGE_CONFIG_KEY = 'fitpantry_supabase_config';

  let clientInstance = null;

  function getSupabaseConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.url && parsed.anonKey) {
          return { url: parsed.url, anonKey: parsed.anonKey };
        }
      }
    } catch (e) {
      console.warn('[SupabaseClient] Error leyendo configuración de localStorage:', e);
    }

    if (window.FIT_SUPABASE_CONFIG && window.FIT_SUPABASE_CONFIG.url && window.FIT_SUPABASE_CONFIG.anonKey) {
      return window.FIT_SUPABASE_CONFIG;
    }

    return {
      url: DEFAULT_SUPABASE_URL,
      anonKey: DEFAULT_SUPABASE_ANON_KEY
    };
  }

  function saveSupabaseConfig(url, anonKey) {
    try {
      const cleanUrl = (url || '').trim();
      const cleanKey = (anonKey || '').trim();
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify({ url: cleanUrl, anonKey: cleanKey }));
      clientInstance = null; // Forzar reinicialización
      initSupabaseClient();
      return true;
    } catch (e) {
      console.error('[SupabaseClient] Error guardando credenciales:', e);
      return false;
    }
  }

  function isConfigured() {
    const config = getSupabaseConfig();
    return (
      config.url &&
      config.anonKey &&
      !config.url.includes('tu-proyecto') &&
      !config.anonKey.includes('tu-anon-key')
    );
  }

  function initSupabaseClient() {
    if (clientInstance) return clientInstance;

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      console.warn('[SupabaseClient] Supabase SDK no está disponible en window.supabase.');
      return null;
    }

    const config = getSupabaseConfig();
    if (!config.url || !config.anonKey) return null;

    try {
      clientInstance = window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'fitpantry_sb_auth_token_el'
        }
      });
      return clientInstance;
    } catch (err) {
      console.error('[SupabaseClient] Error inicializando Supabase:', err);
      return null;
    }
  }

  const SupabaseAuth = {
    getClient() {
      return initSupabaseClient();
    },

    isConfigured,
    getSupabaseConfig,
    saveSupabaseConfig,

    async signUp(email, password, nombre = '') {
      const client = initSupabaseClient();
      if (!client) throw new Error('Supabase no está configurado. Introduce tu URL y Anon Key en Ajustes.');

      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            rol_perfil: 'hombre',
            nombre: nombre || email.split('@')[0]
          }
        }
      });

      if (error) throw error;
      return data;
    },

    async signIn(email, password) {
      const client = initSupabaseClient();
      if (!client) throw new Error('Supabase no está configurado. Introduce tu URL y Anon Key en Ajustes.');

      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      return data;
    },

    async signOut() {
      const client = initSupabaseClient();
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) console.warn('[SupabaseClient] Error al cerrar sesión:', error);
    },

    async resetPassword(email) {
      const client = initSupabaseClient();
      if (!client) throw new Error('Supabase no está configurado.');
      const { data, error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      });
      if (error) throw error;
      return data;
    },

    async getSession() {
      const client = initSupabaseClient();
      if (!client) return null;
      try {
        const { data, error } = await client.auth.getSession();
        if (error || !data) return null;
        return data.session;
      } catch (e) {
        return null;
      }
    },

    async getUser() {
      const session = await this.getSession();
      return session ? session.user : null;
    },

    onAuthStateChange(callback) {
      const client = initSupabaseClient();
      if (!client) return { unsubscribe: () => {} };
      const { data: subscription } = client.auth.onAuthStateChange((event, session) => {
        if (typeof callback === 'function') {
          callback(event, session);
        }
      });
      return subscription.subscription;
    }
  };

  window.SupabaseAuth = SupabaseAuth;
})(window);
