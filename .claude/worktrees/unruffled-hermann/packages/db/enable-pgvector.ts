import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function enablePgVector() {
  try {
    console.log('Enabling pgvector extension...');
    
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✅ pgvector extension enabled successfully!');
    
    const result = await prisma.$queryRawUnsafe(
      "SELECT * FROM pg_extension WHERE extname = 'vector';"
    );
    console.log('Extension info:', result);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

enablePgVector();
