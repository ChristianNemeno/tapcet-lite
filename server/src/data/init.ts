import { randomUUID } from 'node:crypto';

import { pool } from './db.js';

interface SeedQuestion {
  text: string;
  options: string[];
  answer: number;
  orderIndex: number;
}

interface SeedQuiz {
  title: string;
  description: string;
  timeLimitSeconds: number;
  questions: SeedQuestion[];
}

const seedData: SeedQuiz[] = [
  {
    title: 'General Knowledge',
    description: 'A broad mix of trivia covering history, science, geography, and culture.',
    timeLimitSeconds: 60,
    questions: [
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
    ],
  },
  {
    title: 'Web Development',
    description: 'Test your knowledge of HTML, CSS, JavaScript, and modern web concepts.',
    timeLimitSeconds: 90,
    questions: [
      {
        text: 'Which CSS property controls the space between an element\'s border and its content?',
        options: ['margin', 'padding', 'spacing', 'gap'],
        answer: 1,
        orderIndex: 0,
      },
      {
        text: 'What does the "S" in HTTPS stand for?',
        options: ['Server', 'Secure', 'Session', 'Static'],
        answer: 1,
        orderIndex: 1,
      },
      {
        text: 'Which HTML tag is used to link an external CSS stylesheet?',
        options: ['<style>', '<script>', '<link>', '<css>'],
        answer: 2,
        orderIndex: 2,
      },
      {
        text: 'In JavaScript, which method converts a JSON string into an object?',
        options: ['JSON.stringify()', 'JSON.parse()', 'JSON.decode()', 'JSON.convert()'],
        answer: 1,
        orderIndex: 3,
      },
      {
        text: 'What is the default display value of a <div> element?',
        options: ['inline', 'block', 'flex', 'grid'],
        answer: 1,
        orderIndex: 4,
      },
      {
        text: 'Which HTTP method is typically used to update a resource?',
        options: ['GET', 'POST', 'PUT', 'DELETE'],
        answer: 2,
        orderIndex: 5,
      },
    ],
  },
  {
    title: 'Science & Nature',
    description: 'Explore questions about biology, chemistry, physics, and the natural world.',
    timeLimitSeconds: 75,
    questions: [
      {
        text: 'What is the chemical symbol for gold?',
        options: ['Go', 'Gd', 'Au', 'Ag'],
        answer: 2,
        orderIndex: 0,
      },
      {
        text: 'How many bones are in the adult human body?',
        options: ['186', '206', '226', '246'],
        answer: 1,
        orderIndex: 1,
      },
      {
        text: 'What is the powerhouse of the cell?',
        options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi apparatus'],
        answer: 2,
        orderIndex: 2,
      },
      {
        text: 'At what temperature does water boil at sea level (°C)?',
        options: ['90', '95', '100', '105'],
        answer: 2,
        orderIndex: 3,
      },
      {
        text: 'Which gas do plants absorb from the atmosphere during photosynthesis?',
        options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'],
        answer: 2,
        orderIndex: 4,
      },
      {
        text: 'What is the speed of light in a vacuum (approximately)?',
        options: ['300,000 km/s', '150,000 km/s', '500,000 km/s', '1,000,000 km/s'],
        answer: 0,
        orderIndex: 5,
      },
    ],
  },
];

export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        time_limit_seconds INTEGER
      )
    `);

    // Idempotent column additions for existing deployments
    await client.query(`
      ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''
    `);
    await client.query(`
      ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id UUID PRIMARY KEY,
        quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        nickname TEXT NOT NULL,
        score INTEGER NOT NULL,
        total INTEGER NOT NULL,
        percentage FLOAT NOT NULL,
        completed_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM quizzes',
    );

    if (Number(rows[0]?.count ?? '0') === 0) {
      for (const quiz of seedData) {
        const quizId = randomUUID();

        await client.query(
          'INSERT INTO quizzes (id, title, description, time_limit_seconds) VALUES ($1, $2, $3, $4)',
          [quizId, quiz.title, quiz.description, quiz.timeLimitSeconds],
        );

        for (const question of quiz.questions) {
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
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
