/**
 * Script para aplicar la migración de Storage usando la API de Supabase
 * Ejecutar con: npx tsx scripts/apply-storage-migration.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function applyMigration() {
  console.log('🔧 Aplicando migración de Storage...\n');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variables de entorno faltantes');
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
    // 1. Crear el bucket "documents" si no existe
    console.log('📦 Creando bucket "documents"...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      throw bucketsError;
    }

    const documentsBucket = buckets?.find(b => b.name === 'documents');

    if (!documentsBucket) {
      const { error: createError } = await supabase.storage.createBucket('documents', {
        public: false,
        fileSizeLimit: 52428800, // 50MB
      });

      if (createError) {
        throw createError;
      }

      console.log('✅ Bucket "documents" creado exitosamente\n');
    } else {
      console.log('✅ Bucket "documents" ya existe\n');
    }

    // 2. Aplicar políticas RLS usando SQL directo
    console.log('🔐 Configurando políticas RLS...');

    // Leer el archivo de migración SQL
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20251105030826_create_documents_bucket_and_policies.sql',
    );

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Archivo de migración no encontrado: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Extraer solo las políticas SQL (sin el INSERT del bucket que ya hicimos)
    const policiesSQL = migrationSQL
      .split('\n')
      .filter(line => !line.includes('INSERT INTO storage.buckets'))
      .filter(line => !line.includes('ALTER TABLE storage.objects ENABLE'))
      .join('\n');

    // Ejecutar las políticas SQL usando rpc o directamente
    // Nota: Para ejecutar SQL arbitrario, necesitamos usar la API REST directamente
    // o usar el cliente de Postgres. Por ahora, vamos a intentar con el método de Supabase

    console.log('\n📝 SQL de políticas a aplicar:');
    console.log(policiesSQL);
    console.log('\n⚠️  Nota: Las políticas RLS deben aplicarse manualmente desde el SQL Editor');
    console.log('   o usando el comando: supabase db push');
    console.log('\n✅ Bucket creado exitosamente');
    console.log('📋 Próximo paso: Aplicar las políticas SQL desde el Dashboard o CLI\n');

    // Intentar aplicar las políticas usando la API REST
    const policies = [
      {
        name: 'Users can read their own files',
        sql: `
          CREATE POLICY IF NOT EXISTS "Users can read their own files"
          ON storage.objects
          FOR SELECT
          TO authenticated
          USING (
            bucket_id = 'documents' 
            AND (auth.uid())::text = (storage.foldername(name))[1]
          );
        `,
      },
      {
        name: 'Users can upload their own files',
        sql: `
          CREATE POLICY IF NOT EXISTS "Users can upload their own files"
          ON storage.objects
          FOR INSERT
          TO authenticated
          WITH CHECK (
            bucket_id = 'documents' 
            AND (auth.uid())::text = (storage.foldername(name))[1]
          );
        `,
      },
      {
        name: 'Users can delete their own files',
        sql: `
          CREATE POLICY IF NOT EXISTS "Users can delete their own files"
          ON storage.objects
          FOR DELETE
          TO authenticated
          USING (
            bucket_id = 'documents' 
            AND (auth.uid())::text = (storage.foldername(name))[1]
          );
        `,
      },
      {
        name: 'Authenticated users can read global files',
        sql: `
          CREATE POLICY IF NOT EXISTS "Authenticated users can read global files"
          ON storage.objects
          FOR SELECT
          TO authenticated
          USING (
            bucket_id = 'documents' 
            AND (storage.foldername(name))[1] = 'global'
          );
        `,
      },
    ];

    console.log('📋 Políticas que necesitan ser aplicadas:\n');
    policies.forEach((policy, index) => {
      console.log(`${index + 1}. ${policy.name}`);
    });

    console.log('\n💡 Para aplicar las políticas, ejecuta este SQL en el SQL Editor de Supabase:\n');
    console.log('---');
    policies.forEach((policy) => {
      console.log(policy.sql);
    });
    console.log('---\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

applyMigration();
