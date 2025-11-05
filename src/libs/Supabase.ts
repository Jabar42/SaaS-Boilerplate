import { createClient } from '@supabase/supabase-js';

import { Env } from './Env';

// Inicializar cliente de Supabase para uso en componentes cliente
export const supabase = createClient(
  Env.NEXT_PUBLIC_SUPABASE_URL || '',
  Env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);
