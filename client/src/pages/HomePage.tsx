import { useEffect, useState } from 'react';

import Spinner from '../components/Spinner';
import { fetchQuizzes } from '../api';
import type { QuizSummary } from '../types';
import styles from './HomePage.module.css';

interface HomePageProps {
  onSelectQuiz: (quizId: string, quizTitle: string, timeLimitSeconds: number | null) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

export default function HomePage({ onSelectQuiz }: HomePageProps) {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchQuizzes();
        if (!cancelled) setQuizzes(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load quizzes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className="eyebrow">Welcome</p>
        <h1 className={styles.title}>Quiz<span className={styles.accent}>.</span></h1>
        <p className={styles.subtitle}>
          Pick a topic, enter your nickname, and race the clock. Your best scores go on the leaderboard.
        </p>
      </header>

      <section className={styles.catalog}>
        <h2 className={styles.sectionTitle}>Choose a Quiz</h2>

        {loading ? (
          <div className={styles.centered}>
            <Spinner />
          </div>
        ) : error ? (
          <div className={styles.feedback}>
            <p>{error}</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {quizzes.map((quiz) => (
              <button
                key={quiz.id}
                type="button"
                className={styles.quizCard}
                onClick={() => onSelectQuiz(quiz.id, quiz.title, quiz.timeLimitSeconds)}
              >
                <div className={styles.cardTop}>
                  <h3 className={styles.quizTitle}>{quiz.title}</h3>
                  <p className={styles.description}>{quiz.description}</p>
                </div>
                <div className={styles.cardMeta}>
                  <span className={styles.metaBadge}>
                    {quiz.questionCount} questions
                  </span>
                  {quiz.timeLimitSeconds !== null && (
                    <span className={`${styles.metaBadge} ${styles.timeBadge}`}>
                      ⏱ {formatTime(quiz.timeLimitSeconds)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
