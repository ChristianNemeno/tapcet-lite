import { Request, Router } from 'express';

import { pool } from '../data/db.js';
import type {
  QuizQuestion,
  QuizResponse,
  SubmitQuizRequest,
  SubmitQuizResponse,
} from '../types.js';

interface QuizRow {
  id: string;
  title: string;
}

interface QuestionRow {
  id: string;
  text: string;
  options: string[];
  order_index: number;
  answer: number;
}

const router = Router();

router.get('/quiz', async (_req, res, next) => {
  try {
    const quizResult = await pool.query<QuizRow>(
      'SELECT id, title FROM quizzes ORDER BY title ASC LIMIT 1',
    );

    const quiz = quizResult.rows[0];

    if (!quiz) {
      res.status(404).json({ message: 'Quiz not found.' });
      return;
    }

    const questionsResult = await pool.query<QuestionRow>(
      `
        SELECT id, text, options, order_index
        FROM questions
        WHERE quiz_id = $1
        ORDER BY order_index ASC
      `,
      [quiz.id],
    );

    const questions: QuizQuestion[] = questionsResult.rows.map((row) => ({
      id: row.id,
      text: row.text,
      options: row.options,
      orderIndex: row.order_index,
    }));

    const response: QuizResponse = {
      id: quiz.id,
      title: quiz.title,
      questions,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/quiz/submit',
  async (req: Request<Record<string, never>, unknown, SubmitQuizRequest>, res, next) => {
    try {
      const answers =
        req.body && typeof req.body.answers === 'object' && req.body.answers !== null
          ? req.body.answers
          : {};

      const quizResult = await pool.query<QuizRow>(
        'SELECT id FROM quizzes ORDER BY title ASC LIMIT 1',
      );

      const quiz = quizResult.rows[0];

      if (!quiz) {
        res.status(404).json({ message: 'Quiz not found.' });
        return;
      }

      const questionsResult = await pool.query<QuestionRow>(
        `
          SELECT id, text, options, answer, order_index
          FROM questions
          WHERE quiz_id = $1
          ORDER BY order_index ASC
        `,
        [quiz.id],
      );

      const results = questionsResult.rows.map((question) => {
        const rawSelected = answers[question.id];
        const selectedAnswer =
          Number.isInteger(rawSelected) ? rawSelected : null;
        const correct = selectedAnswer === question.answer;

        return {
          questionId: question.id,
          questionText: question.text,
          options: question.options,
          correct,
          selectedAnswer,
          correctAnswer: question.answer,
        };
      });

      const score = results.filter((item) => item.correct).length;
      const total = results.length;

      const response: SubmitQuizResponse = {
        score,
        total,
        percentage: total === 0 ? 0 : Math.round((score / total) * 100),
        results,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
