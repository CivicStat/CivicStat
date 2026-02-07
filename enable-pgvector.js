const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:Civicstat2026!@db.xairvkwkejodxrmfqvsa.supabase.co:5432/postgres'
});

async function enablePgVector() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    const result = await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✅ pgvector extension enabled successfully!');
    
    const check = await client.query("SELECT * FROM pg_extension WHERE extname = 'vector';");
    console.log('Extension info:', check.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

enablePgVector();
