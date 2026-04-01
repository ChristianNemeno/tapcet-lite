import { useEffect, useState } from 'react';

import Spinner from '../components/Spinner';
import { fetchLeaderboard } from '../api';
import type { LeaderboardEntry, SubmitQuizResponse } from '../types';
import styles from './ResultsPage.module.css';

interface ResultsPageProps {
  results: SubmitQuizResponse;
  onPlayAgain: () => void;
}

function scoreLabel(pct: number): string {
  if (pct === 100) return 'Perfect!';
  if (pct >= 80) return 'Great job!';
  if (pct >= 60) return 'Not bad!';
  if (pct >= 40) return 'Keep practicing!';
  return 'Better luck next time!';
}

export default function ResultsPage({ results, onPlayAgain }: ResultsPageProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchLeaderboard(results.quizId);
        if (!cancelled) setLeaderboard(data);
      } catch {
        // leaderboard is non-critical, fail silently
      } finally {
        if (!cancelled) setLbLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [results.quizId]);

  return (
    <main className={styles.page}>
      <section className={styles.summary}>
        <p className="eyebrow">Results</p>
        <div className={styles.scoreRow}>
          <span className={styles.percentage}>{results.percentage}%</span>
          <span className={styles.verdict}>{scoreLabel(results.percentage)}</span>
        </div>
        <p className={styles.scoreText}>
          {results.nickname && <><strong>{results.nickname}</strong> — </>}
          {results.score} / {results.total} correct
        </p>
        <button type="button" className="btn-primary" onClick={onPlayAgain}>
          ← Play Another Quiz
        </button>
      </section>

      <div className={styles.columns}>
        <section className={styles.breakdown}>
          <h2 className={styles.sectionTitle}>Breakdown</h2>
          {results.results.map((item, index) => (
            <article key={item.questionId} className={`${styles.card} ${item.correct ? styles.cardCorrect : styles.cardIncorrect}`}>
              <div className={styles.cardHeader}>
                <span className={item.correct ? styles.correctBadge : styles.incorrectBadge}>
                  {item.correct ? '✓ Correct' : '✗ Incorrect'}
                </span>
                <span className={styles.qIndex}>Q{index + 1}</span>
              </div>
              <p className={styles.questionText}>{item.questionText}</p>
              <div className={styles.answerRow}>
                <div className={styles.answerBlock}>
                  <p className={styles.answerLabel}>Your answer</p>
                  <p className={`${styles.answerValue} ${!item.correct ? styles.wrongAnswer : ''}`}>
                    {item.selectedAnswer === null
                      ? 'No answer'
                      : item.options[item.selectedAnswer]}
                  </p>
                </div>
                {!item.correct && (
                  <div className={styles.answerBlock}>
                    <p className={styles.answerLabel}>Correct answer</p>
                    <p className={`${styles.answerValue} ${styles.rightAnswer}`}>
                      {item.options[item.correctAnswer]}
                    </p>
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className={styles.leaderboard}>
          <h2 className={styles.sectionTitle}>Leaderboard</h2>
          {lbLoading ? (
            <div className={styles.lbLoading}><Spinner /></div>
          ) : leaderboard.length === 0 ? (
            <p className={styles.emptyBoard}>No scores yet.</p>
          ) : (
            <ol className={styles.lbList}>
              {leaderboard.map((entry, i) => {
                const isMe = results.nickname !== null && entry.nickname === results.nickname;
                return (
                  <li key={entry.id} className={`${styles.lbEntry} ${isMe ? styles.myEntry : ''}`}>
                    <span className={styles.rank}>#{i + 1}</span>
                    <span className={styles.lbNickname}>{entry.nickname}</span>
                    <span className={styles.lbScore}>{entry.percentage}%</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
