import { Pool } from 'pg';

const defaultDatabaseUrl =
  'postgresql://quizuser:quizpass@localhost:5432/quizdb';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? defaultDatabaseUrl,
});
