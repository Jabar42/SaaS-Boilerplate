/**
 * Script de prueba para verificar la conexión con Supabase
 * Ejecutar con: npx tsx scripts/test-supabase.ts
 */

import * as path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Cargar variables de entorno desde .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testSupabaseConnection() {
  console.log('🔍 Verificando configuración de Supabase...\n');

  // Verificar variables de entorno
  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL no está configurada');
    process.exit(1);
  }

  if (!supabaseAnonKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY no está configurada');
    process.exit(1);
  }

  console.log('✅ Variables de entorno encontradas:');
  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Anon Key: ${supabaseAnonKey.substring(0, 20)}...\n`);

  // Crear cliente de Supabase
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    // Probar conexión básica con Storage
    console.log('🔌 Probando conexión con Supabase Storage...');
    const { error: healthError } = await supabase.storage.listBuckets();

    if (healthError) {
      throw healthError;
    }

    console.log('✅ Conexión exitosa con Supabase Storage\n');

    // Verificar bucket de documentos
    console.log('📦 Verificando bucket "documents"...');

    // Intentar listar buckets (puede fallar si el Anon Key no tiene permisos)
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.log(`⚠️  No se pueden listar buckets (RLS): ${bucketsError.message}`);
      console.log('   Esto es normal si el bucket es privado y el Anon Key no tiene permisos\n');
    }

    const documentsBucket = buckets?.find(b => b.name === 'documents');

    if (documentsBucket) {
      console.log('✅ Bucket "documents" encontrado en la lista');
      console.log(`   ID: ${documentsBucket.id}`);
      console.log(`   Público: ${documentsBucket.public ? 'Sí' : 'No'}`);
      console.log(`   Creado: ${documentsBucket.created_at}\n`);
    } else {
      // Si no aparece en la lista, intentar verificar si existe probando listar archivos
      console.log('📋 Intentando verificar existencia del bucket probando acceso...');

      const { data: testList, error: testError } = await supabase.storage
        .from('documents')
        .list('', { limit: 1 });

      if (testError) {
        if (testError.message.includes('Bucket not found') || testError.message.includes('does not exist')) {
          console.log('❌ El bucket "documents" no existe o no es accesible');
          console.log('   Verifica que el bucket esté creado en el Dashboard\n');
        } else {
          console.log('✅ El bucket "documents" existe (pero no se puede listar por RLS)');
          console.log(`   Error de acceso: ${testError.message}`);
          console.log('   Esto es normal - el bucket es privado y necesita autenticación\n');
        }
      } else {
        console.log('✅ Bucket "documents" existe y es accesible');
        console.log(`   Archivos encontrados: ${testList?.length || 0}\n`);
      }
    }

    console.log('✅ Todas las pruebas completadas\n');
    console.log('📝 Próximos pasos:');
    console.log('   1. Asegúrate de que el bucket "documents" existe');
    console.log('   2. Configura las políticas RLS según las instrucciones');
    console.log('   3. Prueba subir un archivo desde la interfaz\n');
  } catch (error) {
    console.error('❌ Error al conectar con Supabase:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testSupabaseConnection();
