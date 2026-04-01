import { useCallback, useEffect, useRef, useState } from 'react';

import ProgressBar from '../components/ProgressBar';
import Spinner from '../components/Spinner';
import Timer from '../components/Timer';
import { fetchQuiz, submitQuiz } from '../api';
import type { AnswersMap, QuizResponse, SubmitQuizResponse } from '../types';
import styles from './QuizPage.module.css';

interface QuizPageProps {
  quizId: string;
  nickname: string;
  timeLimitSeconds: number | null;
  onResults: (results: SubmitQuizResponse) => void;
}

export default function QuizPage({ quizId, nickname, timeLimitSeconds, onResults }: QuizPageProps) {
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchQuiz(quizId);
        if (!cancelled) setQuiz(data);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load quiz.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [quizId]);

  const handleSubmit = useCallback(
    async (currentAnswers: AnswersMap) => {
      if (!quiz || submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setError(null);

      try {
        const results = await submitQuiz(quiz.id, currentAnswers, nickname);
        onResults(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit quiz.');
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [quiz, nickname, onResults],
  );

  const handleTimerExpire = useCallback(() => {
    void handleSubmit(answers);
  }, [handleSubmit, answers]);

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.centered}><Spinner /></div>
      </main>
    );
  }

  if (error && !quiz) {
    return (
      <main className={styles.page}>
        <div className={styles.feedback}><p>{error}</p></div>
      </main>
    );
  }

  if (!quiz) return null;

  const questions = quiz.questions;
  const question = questions[currentIndex];
  const total = questions.length;
  const answeredCount = Object.keys(answers).length;
  const isLast = currentIndex === total - 1;
  const currentAnswered = question ? answers[question.id] !== undefined : false;

  function selectAnswer(questionId: string, optionIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  }

  function goNext() {
    if (currentIndex < total - 1) setCurrentIndex((i) => i + 1);
  }

  function goPrev() {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.quizMeta}>
            <p className="eyebrow">{quiz.title}</p>
            <p className={styles.nickname}>Playing as <strong>{nickname}</strong></p>
          </div>
          {timeLimitSeconds !== null && (
            <Timer totalSeconds={timeLimitSeconds} onExpire={handleTimerExpire} />
          )}
        </div>
        <ProgressBar current={answeredCount} total={total} />
      </header>

      <section className={styles.questionCard} key={question.id}>
        <div className={styles.questionHeader}>
          <span className={styles.questionBadge}>
            Question {currentIndex + 1} of {total}
          </span>
        </div>

        <h2 className={styles.questionText}>{question.text}</h2>

        <div className={styles.options}>
          {question.options.map((option, i) => {
            const checked = answers[question.id] === i;
            return (
              <label
                key={`${question.id}-${i}`}
                className={`${styles.option} ${checked ? styles.optionActive : ''}`}
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={checked}
                  onChange={() => selectAnswer(question.id, i)}
                />
                <span className={styles.optionLetter}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      </section>

      {error && <p className={styles.errorText}>{error}</p>}

      <nav className={styles.nav}>
        <button
          type="button"
          className="btn-secondary"
          onClick={goPrev}
          disabled={currentIndex === 0}
        >
          ← Prev
        </button>

        <span className={styles.navLabel}>
          {answeredCount}/{total} answered
        </span>

        {isLast ? (
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleSubmit(answers)}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit →'}
          </button>
        ) : (
          <button
            type="button"
            className={`btn-secondary ${currentAnswered ? styles.nextActive : ''}`}
            onClick={goNext}
          >
            Next →
          </button>
        )}
      </nav>
    </main>
  );
}
