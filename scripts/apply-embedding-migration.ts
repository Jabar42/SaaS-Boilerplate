import * as fs from 'node:fs';
import * as path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function applyMigration() {
  console.log('🔧 Aplicando migración de embeddings (vector 1536 → 768)...\n');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variables de entorno faltantes');
    console.error('   Se requiere: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Crear cliente con service role key para operaciones administrativas
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Leer el archivo de migración SQL
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20250115000000_change_embedding_dimension_to_768.sql',
    );

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Archivo de migración no encontrado: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📦 Ejecutando migración SQL...\n');

    // Ejecutar la migración usando rpc o directamente
    // Supabase no tiene un método directo para ejecutar SQL arbitrario,
    // así que usaremos el método de ejecutar SQL directamente
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Si el método rpc no existe, intentar ejecutar directamente
      // usando el cliente de PostgreSQL
      console.log('⚠️  Método RPC no disponible, intentando ejecutar SQL directamente...\n');

      // Dividir el SQL en statements individuales
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      console.log(`📝 Ejecutando ${statements.length} statements...\n`);

      // Ejecutar cada statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (!statement) {
          continue;
        }

        try {
          // Usar el método de ejecutar SQL del cliente
          // Nota: Esto requiere que Supabase tenga habilitado el acceso directo a SQL
          await supabase
            .from('_migrations')
            .select('*')
            .limit(0); // Esto es solo para verificar conexión

          // Como Supabase no permite ejecutar SQL arbitrario directamente,
          // necesitamos usar el dashboard o psql
          console.log('⚠️  Supabase JS client no permite ejecutar SQL arbitrario.');
          console.log('📋 Por favor, ejecuta la migración manualmente:\n');
          console.log('   Opción 1: Usar Supabase Dashboard');
          console.log('   1. Ve a: https://app.supabase.com/project/vokmywtmmrmeryjukozr/sql/new');
          console.log('   2. Copia y pega el contenido del archivo:');
          console.log(`      ${migrationPath}\n`);
          console.log('   3. Haz clic en "Run"\n');
          console.log('   Opción 2: Usar psql directamente');
          console.log('   psql "postgresql://postgres.vokmywtmmrmeryjukozr:Jalubami9820@@aws-1-us-east-1.pooler.supabase.com:5432/postgres" -f supabase/migrations/20250115000000_change_embedding_dimension_to_768.sql\n');

          // Mostrar el SQL para que el usuario lo copie
          console.log('📄 Contenido de la migración:\n');
          console.log('─'.repeat(80));
          console.log(migrationSQL);
          console.log('─'.repeat(80));

          process.exit(0);
        } catch (err) {
          console.error(`❌ Error ejecutando statement ${i + 1}:`, err);
          throw err;
        }
      }
    } else {
      console.log('✅ Migración aplicada exitosamente\n');
    }
  } catch (error) {
    console.error('❌ Error aplicando migración:', error);
    console.error('\n📋 Por favor, ejecuta la migración manualmente usando una de las opciones anteriores.\n');
    process.exit(1);
  }
}

applyMigration();
