import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import express from 'express';

import { initializeDatabase } from './data/init.js';
import quizRouter from './routes/quiz.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT ?? 3001);
const nodeEnv = process.env.NODE_ENV ?? 'development';
const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

async function startServer(): Promise<void> {
  await initializeDatabase();

  const app = express();

  if (nodeEnv !== 'production') {
    app.use(
      cors({
        origin: clientOrigin,
      }),
    );
  }

  app.use(express.json());
  app.use('/api', quizRouter);

  if (nodeEnv === 'production') {
    const publicDir = path.resolve(__dirname, '../public');

    app.use(express.static(publicDir));

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }

      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ message: 'Internal server error.' });
  });

  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server.', error);
  process.exit(1);
});
