import { FormEvent, useEffect, useState } from 'react';

import Spinner from '../components/Spinner';
import { fetchQuiz, submitQuiz } from '../api';
import type { AnswersMap, QuizResponse, SubmitQuizResponse } from '../types';
import styles from './QuizPage.module.css';

interface QuizPageProps {
  onResults: (results: SubmitQuizResponse) => void;
}

export default function QuizPage({ onResults }: QuizPageProps) {
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadQuiz() {
      try {
        setLoading(true);
        setError(null);
        const nextQuiz = await fetchQuiz();

        if (!cancelled) {
          setQuiz(nextQuiz);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Failed to load quiz.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadQuiz();

    return () => {
      cancelled = true;
    };
  }, []);

  function selectAnswer(questionId: string, optionIndex: number) {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: optionIndex,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!quiz) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const results = await submitQuiz(answers);
      onResults(results);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Failed to submit quiz.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const totalQuestions = quiz?.questions.length ?? 0;
  const isComplete = totalQuestions > 0 && Object.keys(answers).length === totalQuestions;

  return (
    <main className={styles.page}>
      <section className={`glass ${styles.hero}`}>
        <p className={styles.eyebrow}>Live Demo</p>
        <h1 className={styles.title}>Quiz App</h1>
        <p className={styles.subtitle}>
          Load one quiz, pick one answer per question, submit once, and get a full
          scored breakdown back from the server.
        </p>
      </section>

      <section className={`glass ${styles.panel}`}>
        {loading ? (
          <div className={styles.centered}>
            <Spinner />
          </div>
        ) : error ? (
          <div className={styles.feedback}>
            <p>{error}</p>
          </div>
        ) : quiz ? (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.header}>
              <div>
                <p className={styles.eyebrow}>Current Quiz</p>
                <h2 className={styles.quizTitle}>{quiz.title}</h2>
              </div>
              <p className={styles.progress}>
                {Object.keys(answers).length}/{totalQuestions} answered
              </p>
            </div>

            <div className={styles.questions}>
              {quiz.questions.map((question, questionIndex) => (
                <article key={question.id} className={`glass ${styles.card}`}>
                  <div className={styles.cardHeader}>
                    <span className={styles.badge}>Question {questionIndex + 1}</span>
                    <p className={styles.questionText}>{question.text}</p>
                  </div>

                  <div className={styles.options}>
                    {question.options.map((option, optionIndex) => {
                      const checked = answers[question.id] === optionIndex;

                      return (
                        <label
                          key={`${question.id}-${optionIndex}`}
                          className={`${styles.option} ${checked ? styles.optionActive : ''}`}
                        >
                          <input
                            type="radio"
                            name={question.id}
                            checked={checked}
                            onChange={() => selectAnswer(question.id, optionIndex)}
                          />
                          <span>{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={!isComplete || submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          </form>
        ) : (
          <div className={styles.feedback}>
            <p>No quiz is currently available.</p>
          </div>
        )}
      </section>
    </main>
  );
}
