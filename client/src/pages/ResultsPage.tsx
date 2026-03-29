import type { SubmitQuizResponse } from '../types';
import styles from './ResultsPage.module.css';

interface ResultsPageProps {
  results: SubmitQuizResponse;
  onRetry: () => void;
}

export default function ResultsPage({ results, onRetry }: ResultsPageProps) {
  return (
    <main className={styles.page}>
      <section className={`glass ${styles.summary}`}>
        <p className={styles.eyebrow}>Results</p>
        <h1 className={styles.title}>{results.percentage}%</h1>
        <p className={styles.score}>
          You scored {results.score} out of {results.total}.
        </p>
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          Try Again
        </button>
      </section>

      <section className={styles.results}>
        {results.results.map((item, index) => (
          <article key={item.questionId} className={`glass ${styles.card}`}>
            <div className={styles.header}>
              <span className={item.correct ? styles.correctBadge : styles.incorrectBadge}>
                {item.correct ? 'Correct' : 'Incorrect'}
              </span>
              <span className={styles.index}>Question {index + 1}</span>
            </div>

            <h2 className={styles.question}>{item.questionText}</h2>

            <div className={styles.answerBlock}>
              <p className={styles.label}>Your answer</p>
              <p className={styles.value}>
                {item.selectedAnswer === null
                  ? 'No answer submitted'
                  : item.options[item.selectedAnswer]}
              </p>
            </div>

            <div className={styles.answerBlock}>
              <p className={styles.label}>Correct answer</p>
              <p className={styles.value}>{item.options[item.correctAnswer]}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
