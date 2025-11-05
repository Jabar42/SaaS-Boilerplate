/**
 * Script de prueba para verificar la subida de archivos
 * Ejecutar con: npx tsx scripts/test-upload.ts
 */

import * as path from 'node:path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testUpload() {
  console.log('🧪 Probando subida de archivo...\n');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variables de entorno faltantes');
    process.exit(1);
  }

  // Crear cliente con Service Role Key
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Crear un archivo de prueba
    const testContent = 'Este es un archivo de prueba';
    const testFileName = `test-${Date.now()}.txt`;
    const testFilePath = `tenants/test-user/${testFileName}`;

    console.log('📤 Subiendo archivo de prueba...');
    console.log(`   Ruta: ${testFilePath}\n`);

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(testFilePath, testContent, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'text/plain',
      });

    if (error) {
      console.error('❌ Error al subir:', error.message);
      console.error('   Detalles:', error);
      process.exit(1);
    }

    console.log('✅ Archivo subido exitosamente!');
    console.log(`   Path: ${data.path}\n`);

    // Verificar que el archivo existe
    console.log('🔍 Verificando que el archivo existe...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(testFilePath);

    if (downloadError) {
      console.error('❌ Error al descargar:', downloadError.message);
    } else {
      console.log('✅ Archivo verificado correctamente\n');
      console.log('📋 Contenido del archivo:');
      const text = await fileData.text();
      console.log(`   "${text}"\n`);
    }

    // Limpiar: eliminar archivo de prueba
    console.log('🧹 Eliminando archivo de prueba...');
    const { error: deleteError } = await supabase.storage
      .from('documents')
      .remove([testFilePath]);

    if (deleteError) {
      console.warn('⚠️  Error al eliminar archivo de prueba:', deleteError.message);
    } else {
      console.log('✅ Archivo de prueba eliminado\n');
    }

    console.log('✅ Todas las pruebas completadas exitosamente!\n');
    console.log('💡 El problema podría estar en:');
    console.log('   1. La forma en que se pasa el archivo a la Server Action');
    console.log('   2. El tamaño del archivo (puede estar excediendo límites)');
    console.log('   3. El tipo de archivo (MIME type)');
    console.log('   4. Verificar la consola del navegador para más detalles\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testUpload();
