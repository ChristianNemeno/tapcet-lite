import { randomUUID } from 'node:crypto';

import { Request, Router } from 'express';

import { pool } from '../data/db.js';
import type {
  LeaderboardEntry,
  QuizQuestion,
  QuizResponse,
  QuizSummary,
  SubmitQuizRequest,
  SubmitQuizResponse,
} from '../types.js';

interface QuizRow {
  id: string;
  title: string;
  description: string;
  time_limit_seconds: number | null;
}

interface QuizSummaryRow extends QuizRow {
  question_count: string;
}

interface QuestionRow {
  id: string;
  text: string;
  options: string[];
  order_index: number;
  answer: number;
}

interface LeaderboardRow {
  id: string;
  nickname: string;
  score: number;
  total: number;
  percentage: number;
  completed_at: Date;
}

const router = Router();

router.get('/quizzes', async (_req, res, next) => {
  try {
    const result = await pool.query<QuizSummaryRow>(`
      SELECT q.id, q.title, q.description, q.time_limit_seconds,
             COUNT(qs.id)::text AS question_count
      FROM quizzes q
      LEFT JOIN questions qs ON qs.quiz_id = q.id
      GROUP BY q.id
      ORDER BY q.title ASC
    `);

    const quizzes: QuizSummary[] = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      timeLimitSeconds: row.time_limit_seconds,
      questionCount: Number(row.question_count),
    }));

    res.json(quizzes);
  } catch (error) {
    next(error);
  }
});

router.get('/quiz/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const quizResult = await pool.query<QuizRow>(
      'SELECT id, title, description, time_limit_seconds FROM quizzes WHERE id = $1',
      [id],
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
      description: quiz.description,
      timeLimitSeconds: quiz.time_limit_seconds,
      questions,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/quiz/:id/submit',
  async (req: Request<{ id: string }, unknown, SubmitQuizRequest>, res, next) => {
    try {
      const { id } = req.params;
      const answers =
        req.body && typeof req.body.answers === 'object' && req.body.answers !== null
          ? req.body.answers
          : {};
      const nickname =
        typeof req.body?.nickname === 'string' && req.body.nickname.trim().length > 0
          ? req.body.nickname.trim().slice(0, 20)
          : null;

      const quizResult = await pool.query<QuizRow>(
        'SELECT id FROM quizzes WHERE id = $1',
        [id],
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
      const percentage = total === 0 ? 0 : Math.round((score / total) * 100);

      if (nickname) {
        await pool.query(
          `
            INSERT INTO leaderboard (id, quiz_id, nickname, score, total, percentage)
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [randomUUID(), quiz.id, nickname, score, total, percentage],
        );
      }

      const response: SubmitQuizResponse = {
        score,
        total,
        percentage,
        results,
        quizId: quiz.id,
        nickname,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  },
);

router.get('/quiz/:id/leaderboard', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query<LeaderboardRow>(
      `
        SELECT id, nickname, score, total, percentage, completed_at
        FROM leaderboard
        WHERE quiz_id = $1
        ORDER BY percentage DESC, score DESC, completed_at ASC
        LIMIT 10
      `,
      [id],
    );

    const entries: LeaderboardEntry[] = result.rows.map((row) => ({
      id: row.id,
      nickname: row.nickname,
      score: row.score,
      total: row.total,
      percentage: row.percentage,
      completedAt: row.completed_at.toISOString(),
    }));

    res.json(entries);
  } catch (error) {
    next(error);
  }
});

export default router;
