import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { Env } from './Env';

// Singleton para el cliente de administrador (mejor performance)
let supabaseAdminInstance: SupabaseClient | null = null;

/**
 * Función helper para obtener el cliente de Supabase con Service Role Key
 * ⚠️ NUNCA exponer este key en el cliente
 * Solo usar en Server Components, Server Actions, o API Routes
 */
export function getSupabaseAdmin(): SupabaseClient {
  // Reutilizar instancia si ya existe
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const supabaseUrl = Env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = Env.SUPABASE_SERVICE_ROLE_KEY;

  // Validación estricta - fallar de forma clara si faltan variables
  if (!supabaseUrl) {
    throw new Error(
      '[Supabase Admin] NEXT_PUBLIC_SUPABASE_URL no está configurado. '
      + 'Esta variable es requerida para operaciones con Supabase Storage.',
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      '[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY no está configurado. '
      + 'Esta variable es requerida para operaciones administrativas con Supabase Storage. '
      + 'Obtén este key desde el dashboard de Supabase: Settings > API > Service Role Key.',
    );
  }

  // Crear cliente con Service Role Key (bypass RLS)
  supabaseAdminInstance = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdminInstance;
}
