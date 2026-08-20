import { PrismaClient } from '@prisma/client'

// Prisma client singleton.
//
// On Vercel (serverless), each function invocation is a fresh process —
// the `globalForPrisma` cache prevents multiple PrismaClient instances
// during hot-reload in dev and during a single Lambda warm cycle on Vercel.
//
// We ONLY enable query logging in development — in production (Vercel) it
// would flood the function logs and slow down each request.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const isDev = process.env.NODE_ENV !== 'production'

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ['query', 'error', 'warn'] : ['error', 'warn'],
  })

if (isDev) globalForPrisma.prisma = db
