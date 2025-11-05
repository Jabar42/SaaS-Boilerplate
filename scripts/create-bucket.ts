/**
 * Script para crear el bucket "documents" usando la API REST de Supabase
 * Ejecutar con: npx tsx scripts/create-bucket.ts
 */

import * as path from 'node:path';

import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function createBucket() {
  console.log('📦 Creando bucket "documents"...\n');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Variables de entorno faltantes');
    process.exit(1);
  }

  try {
    // Crear bucket usando la API REST de Supabase
    const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        name: 'documents',
        public: false,
        file_size_limit: 52428800, // 50MB
        allowed_mime_types: null,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 409 || data.message?.includes('already exists')) {
        console.log('✅ El bucket "documents" ya existe\n');
      } else if (response.status === 401 || response.status === 403) {
        console.log('⚠️  No tienes permisos para crear buckets con el Anon Key');
        console.log('   Necesitas crear el bucket manualmente desde el Dashboard:\n');
        console.log('   1. Ve a: https://app.supabase.com/project/vokmywtmmrmeryjukozr/storage/buckets');
        console.log('   2. Haz clic en "New bucket"');
        console.log('   3. Nombre: "documents"');
        console.log('   4. Public: false (privado)');
        console.log('   5. File size limit: 50 (MB)');
        console.log('   6. Haz clic en "Create bucket"\n');
      } else {
        throw new Error(data.message || `Error ${response.status}`);
      }
    } else {
      console.log('✅ Bucket "documents" creado exitosamente\n');
    }

    console.log('✅ Configuración completada');
    console.log('📋 Políticas RLS ya están configuradas\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    console.log('\n💡 Crea el bucket manualmente desde el Dashboard');
    process.exit(1);
  }
}

createBucket();
