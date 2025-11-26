'use server';

import { auth } from '@clerk/nextjs/server';

import type { FileItem } from '@/features/documents/types/file.types';
import { logger } from '@/libs/Logger';
import { getSupabaseAdmin } from '@/libs/SupabaseAdmin';

export async function uploadFile(
  formData: FormData,
): Promise<{ success: boolean; error?: string; path?: string }> {
  try {
    // Verificar autenticación con Clerk
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'No autenticado' };
    }

    // Extraer archivo y nombre del FormData
    const file = formData.get('file') as File | null;
    const fileName = formData.get('fileName') as string | null;

    if (!file) {
      return { success: false, error: 'Archivo no encontrado en FormData' };
    }

    if (!fileName) {
      return { success: false, error: 'Nombre de archivo faltante' };
    }

    // Sanitizar nombre de archivo para evitar problemas con caracteres especiales
    // Supabase Storage requiere nombres sin espacios ni caracteres especiales
    const sanitizeFileName = (originalFileName: string): string => {
      // Obtener extensión del archivo original
      const extension = originalFileName.substring(originalFileName.lastIndexOf('.')) || '';

      // Obtener nombre sin extensión
      const nameWithoutExt = originalFileName.substring(0, originalFileName.lastIndexOf('.')) || originalFileName;

      // Sanitizar: remover caracteres especiales, espacios, acentos
      const sanitized = nameWithoutExt
        .normalize('NFD') // Normalizar caracteres Unicode
        .replace(/[\u0300-\u036F]/g, '') // Remover diacríticos (acentos)
        .replace(/\s+/g, '_') // Reemplazar espacios con guión bajo
        .replace(/[^\w.-]/g, '_') // Reemplazar otros caracteres especiales con guión bajo
        .replace(/_{2,}/g, '_') // Reemplazar múltiples guiones bajos con uno solo
        .replace(/^_+|_+$/g, '') // Remover guiones bajos al inicio/final
        .substring(0, 200); // Limitar longitud

      // Si quedó vacío después de sanitizar, usar nombre por defecto
      const finalName = sanitized || 'archivo';

      // Retornar nombre sanitizado sin timestamp
      // Nota: Si se sube el mismo archivo dos veces, se sobrescribirá
      return `${finalName}${extension}`;
    };

    const sanitizedFileName = sanitizeFileName(file.name);

    // Verificar tamaño del archivo (50MB límite)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: `El archivo excede el tamaño máximo de 50MB (tamaño actual: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
      };
    }

    // Construir ruta del archivo (sin espacios ni caracteres especiales)
    const filePath = `tenants/${userId}/${sanitizedFileName}`;

    // Convertir File a ArrayBuffer para Supabase
    const arrayBuffer = await file.arrayBuffer();

    // Obtener cliente de Supabase (validará que el Service Role Key esté configurado)
    const supabaseAdmin = getSupabaseAdmin();

    // Subir archivo usando Service Role Key
    // Guardar el nombre original en metadata para poder mostrarlo después
    // upsert: true permite sobrescribir archivos con el mismo nombre
    const { data, error } = await supabaseAdmin.storage
      .from('documents')
      .upload(filePath, arrayBuffer, {
        cacheControl: '3600',
        upsert: true, // Permitir sobrescribir si el archivo ya existe
        contentType: file.type || 'application/octet-stream',
        metadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
        },
      });

    if (error) {
      logger.error(
        { error, message: error.message },
        '[Server Action] Error uploading file',
      );
      return {
        success: false,
        error: error.message || 'Error al subir el archivo',
      };
    }

    return { success: true, path: data.path };
  } catch (error) {
    logger.error({ error }, '[Server Action] Exception uploading file');
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error desconocido al subir el archivo',
    };
  }
}

export async function deleteFile(
  filePath: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verificar autenticación con Clerk
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'No autenticado' };
    }

    // Verificar que el archivo pertenece al usuario
    if (!filePath.startsWith(`tenants/${userId}/`)) {
      return { success: false, error: 'No autorizado para eliminar este archivo' };
    }

    // Obtener cliente de Supabase (validará que el Service Role Key esté configurado)
    const supabaseAdmin = getSupabaseAdmin();

    // Eliminar archivo
    const { error } = await supabaseAdmin.storage
      .from('documents')
      .remove([filePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    // Eliminar chunks del vector store
    // No bloquear la eliminación si falla la limpieza de chunks
    try {
      const { deleteDocumentChunksByFilePath } = await import(
        '@/features/documents/utils/vector-store'
      );
      const deleteResult = await deleteDocumentChunksByFilePath(filePath);

      if (!deleteResult.success) {
        logger.warn(
          { error: deleteResult.error, filePath },
          'Error al eliminar chunks del vector store (archivo ya eliminado)',
        );
      }
    } catch (chunkError) {
      logger.warn(
        { error: chunkError, filePath },
        'Error al eliminar chunks del vector store (archivo ya eliminado)',
      );
      // Continuar aunque falle la limpieza de chunks
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function downloadFile(
  filePath: string,
): Promise<{ success: boolean; error?: string; url?: string }> {
  try {
    // Verificar autenticación con Clerk
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: 'No autenticado' };
    }

    // Verificar permisos (archivos del usuario o globales)
    const isUserFile = filePath.startsWith(`tenants/${userId}/`);
    const isGlobalFile = filePath.startsWith('global/');

    if (!isUserFile && !isGlobalFile) {
      return { success: false, error: 'No autorizado para descargar este archivo' };
    }

    // Obtener cliente de Supabase (validará que el Service Role Key esté configurado)
    const supabaseAdmin = getSupabaseAdmin();

    // Generar URL firmada para descarga (válida por 60 segundos)
    const { data, error } = await supabaseAdmin.storage
      .from('documents')
      .createSignedUrl(filePath, 60);

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data?.signedUrl) {
      return { success: false, error: 'No se pudo generar la URL de descarga' };
    }

    return { success: true, url: data.signedUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

export async function listFiles(): Promise<{
  success: boolean;
  error?: string;
  userFiles?: FileItem[];
  globalFiles?: FileItem[];
}> {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    // Verificar autenticación con Clerk
    logger.debug({}, '[Server Action] listFiles: Verificando autenticación');
    const authResult = await auth();
    userId = authResult.userId || undefined;

    if (!userId) {
      logger.warn({
        hasAuthResult: !!authResult,
        timestamp: new Date().toISOString(),
      }, '[Server Action] listFiles: Usuario no autenticado');
      return { success: false, error: 'No autenticado' };
    }

    logger.debug({
      userId,
      timestamp: new Date().toISOString(),
    }, '[Server Action] listFiles: Usuario autenticado');

    // Obtener cliente de Supabase (validará que el Service Role Key esté configurado)
    logger.debug({}, '[Server Action] listFiles: Obteniendo cliente de Supabase');
    let supabaseAdmin;
    try {
      supabaseAdmin = getSupabaseAdmin();
      logger.debug({}, '[Server Action] listFiles: Cliente de Supabase obtenido');
    } catch (supabaseError) {
      const errorMessage = supabaseError instanceof Error ? supabaseError.message : 'Error desconocido al obtener Supabase';
      const errorStack = supabaseError instanceof Error ? supabaseError.stack : undefined;
      logger.error(
        {
          error: supabaseError,
          errorMessage,
          errorStack,
          userId,
          timestamp: new Date().toISOString(),
        },
        '[Server Action] Error obteniendo cliente de Supabase',
      );
      return { success: false, error: `Error de configuración: ${errorMessage}` };
    }

    // Obtener archivos del usuario desde /tenants/{userId}/
    const userPath = `tenants/${userId}/`;
    logger.debug({
      userPath,
      userId,
      timestamp: new Date().toISOString(),
    }, '[Server Action] listFiles: Listando archivos del usuario');

    let userData;
    let userError;
    try {
      const result = await supabaseAdmin.storage
        .from('documents')
        .list(userPath, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });
      userData = result.data;
      userError = result.error;
    } catch (listError) {
      const errorMessage = listError instanceof Error ? listError.message : 'Error desconocido al listar archivos';
      const errorStack = listError instanceof Error ? listError.stack : undefined;
      logger.error(
        {
          error: listError,
          errorMessage,
          errorStack,
          userId,
          userPath,
          timestamp: new Date().toISOString(),
        },
        '[Server Action] Excepción al listar archivos del usuario',
      );
      return { success: false, error: `Error al listar archivos: ${errorMessage}` };
    }

    if (userError) {
      logger.error(
        {
          error: userError,
          userId,
          userPath,
          message: userError.message,
          name: userError.name,
          timestamp: new Date().toISOString(),
        },
        '[Server Action] Error de Supabase listando archivos del usuario',
      );
      return { success: false, error: userError.message || 'Error al listar archivos del usuario' };
    }

    logger.debug({
      filesCount: userData?.length || 0,
      userId,
      timestamp: new Date().toISOString(),
    }, '[Server Action] listFiles: Procesando archivos del usuario');

    let userFiles: FileItem[] = [];
    try {
      userFiles = (userData || []).map((file) => {
        // Usar el nombre original de metadata si existe, sino el nombre sanitizado
        const displayName = (file.metadata?.originalName as string | undefined) || file.name;

        return {
          name: displayName,
          path: `${userPath}${file.name}`,
          size: file.metadata?.size || 0,
          createdAt: new Date(file.created_at || Date.now()),
          updatedAt: new Date(file.updated_at || Date.now()),
          isGlobal: false,
          mimetype: file.metadata?.mimetype as string | undefined,
        };
      });
      logger.debug({
        userFilesCount: userFiles.length,
        userId,
        timestamp: new Date().toISOString(),
      }, '[Server Action] listFiles: Archivos del usuario procesados');
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Error desconocido al procesar archivos';
      const errorStack = parseError instanceof Error ? parseError.stack : undefined;
      logger.error(
        {
          error: parseError,
          errorMessage,
          errorStack,
          userId,
          userDataCount: userData?.length || 0,
          timestamp: new Date().toISOString(),
        },
        '[Server Action] Error procesando archivos del usuario',
      );
      // Continuar con array vacío en lugar de fallar completamente
      userFiles = [];
    }

    // Obtener archivos globales desde /global/
    const globalPath = 'global/';
    logger.debug({
      globalPath,
      userId,
      timestamp: new Date().toISOString(),
    }, '[Server Action] listFiles: Listando archivos globales');

    let globalData: any[] | null = null;
    let globalError: any = null;
    try {
      const result = await supabaseAdmin.storage
        .from('documents')
        .list(globalPath, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });
      globalData = result.data;
      globalError = result.error;
    } catch (listError) {
      const errorMessage = listError instanceof Error ? listError.message : 'Error desconocido al listar archivos globales';
      const errorStack = listError instanceof Error ? listError.stack : undefined;
      logger.error(
        {
          error: listError,
          errorMessage,
          errorStack,
          userId,
          globalPath,
          timestamp: new Date().toISOString(),
        },
        '[Server Action] Excepción al listar archivos globales',
      );
      // No fallar completamente si hay error con archivos globales
      globalError = { message: errorMessage } as any;
    }

    if (globalError) {
      logger.error(
        {
          error: globalError,
          message: globalError?.message || 'Unknown error',
          name: globalError?.name || 'UnknownError',
          userId,
          timestamp: new Date().toISOString(),
        },
        '[Server Action] Error de Supabase listando archivos globales',
      );
      // No fallar completamente si hay error con archivos globales
    }

    let globalFiles: FileItem[] = [];
    if (!globalError) {
      try {
        globalFiles = (globalData || []).map((file) => {
          // Usar el nombre original de metadata si existe, sino el nombre sanitizado
          const displayName = (file.metadata?.originalName as string | undefined) || file.name;

          return {
            name: displayName,
            path: `${globalPath}${file.name}`,
            size: file.metadata?.size || 0,
            createdAt: new Date(file.created_at || Date.now()),
            updatedAt: new Date(file.updated_at || Date.now()),
            isGlobal: true,
            mimetype: file.metadata?.mimetype as string | undefined,
          };
        });
        logger.debug({
          globalFilesCount: globalFiles.length,
          userId,
          timestamp: new Date().toISOString(),
        }, '[Server Action] listFiles: Archivos globales procesados');
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : 'Error desconocido al procesar archivos globales';
        const errorStack = parseError instanceof Error ? parseError.stack : undefined;
        logger.error(
          {
            error: parseError,
            errorMessage,
            errorStack,
            userId,
            globalDataCount: globalData?.length || 0,
            timestamp: new Date().toISOString(),
          },
          '[Server Action] Error procesando archivos globales',
        );
        // Continuar con array vacío
        globalFiles = [];
      }
    }

    const duration = Date.now() - startTime;
    logger.debug({
      userFilesCount: userFiles.length,
      globalFilesCount: globalFiles.length,
      userId,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    }, '[Server Action] listFiles: Éxito');

    return { success: true, userFiles, globalFiles };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'UnknownError';

    logger.error(
      {
        error,
        errorMessage,
        errorStack,
        errorName,
        userId: userId || 'unknown',
        durationMs: duration,
        timestamp: new Date().toISOString(),
      },
      '[Server Action] Exception no manejada en listFiles',
    );
    return {
      success: false,
      error: errorMessage,
    };
  }
}
