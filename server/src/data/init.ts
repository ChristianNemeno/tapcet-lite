import { randomUUID } from 'node:crypto';

import { pool } from './db.js';

interface SeedQuestion {
  text: string;
  options: string[];
  answer: number;
  orderIndex: number;
}

const seedQuestions: SeedQuestion[] = [
  {
    text: 'What is the capital of France?',
    options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
    answer: 2,
    orderIndex: 0,
  },
  {
    text: 'Which planet is known as the Red Planet?',
    options: ['Earth', 'Mars', 'Jupiter', 'Venus'],
    answer: 1,
    orderIndex: 1,
  },
  {
    text: 'What is the largest mammal on Earth?',
    options: ['African Elephant', 'Blue Whale', 'Giraffe', 'Orca'],
    answer: 1,
    orderIndex: 2,
  },
  {
    text: 'Which language runs in a web browser?',
    options: ['Java', 'C', 'Python', 'JavaScript'],
    answer: 3,
    orderIndex: 3,
  },
  {
    text: 'Who wrote "To Kill a Mockingbird"?',
    options: ['Harper Lee', 'Jane Austen', 'George Orwell', 'Mark Twain'],
    answer: 0,
    orderIndex: 4,
  },
  {
    text: 'What does HTTP stand for?',
    options: [
      'HyperText Transfer Protocol',
      'High Transfer Text Process',
      'Hyperlink Transmission Program',
      'Host Transfer Tool Protocol',
    ],
    answer: 0,
    orderIndex: 5,
  },
];

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id UUID PRIMARY KEY,
        quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        options JSONB NOT NULL,
        answer INTEGER NOT NULL,
        order_index INTEGER NOT NULL
      )
    `);

    const { rows } = await client.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM quizzes',
    );

    if (Number(rows[0]?.count ?? '0') === 0) {
      const quizId = randomUUID();

      await client.query(
        'INSERT INTO quizzes (id, title) VALUES ($1, $2)',
        [quizId, 'General Knowledge Quiz'],
      );

      for (const question of seedQuestions) {
        await client.query(
          `
            INSERT INTO questions (id, quiz_id, text, options, answer, order_index)
            VALUES ($1, $2, $3, $4::jsonb, $5, $6)
          `,
          [
            randomUUID(),
            quizId,
            question.text,
            JSON.stringify(question.options),
            question.answer,
            question.orderIndex,
          ],
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
