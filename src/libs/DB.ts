import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Usar DIRECT_URL si está disponible para evitar problemas con el pooler
// El pooler de Supabase (puerto 6543) no soporta todas las operaciones y requiere contexto de tenant
// DIRECT_URL usa el puerto 5432 que es la conexión directa sin restricciones
//
// IMPORTANTE: Si cambias DIRECT_URL, debes reiniciar el servidor de Next.js
// para que el cliente de Prisma se recree con la nueva URL
const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

export const db: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
