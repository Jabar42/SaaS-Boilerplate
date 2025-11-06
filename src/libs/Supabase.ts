import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { Env } from './Env';

// Validar que las variables estén configuradas ANTES de crear el cliente
const supabaseUrl = Env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Si las variables no están configuradas, fallar de forma clara y temprana
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars: string[] = [];
  if (!supabaseUrl) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!supabaseAnonKey) {
    missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  throw new Error(
    `[Supabase] Variables de entorno requeridas no configuradas: ${missingVars.join(', ')}. `
    + 'Por favor, configura estas variables en tu entorno de producción.',
  );
}

// Solo crear el cliente si las variables están configuradas
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
