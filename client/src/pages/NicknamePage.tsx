import { FormEvent, useState } from 'react';

import styles from './NicknamePage.module.css';

interface NicknamePageProps {
  quizId: string;
  quizTitle: string;
  onBack: () => void;
  onStart: (nickname: string) => void;
}

export default function NicknamePage({ quizTitle, onBack, onStart }: NicknamePageProps) {
  const [nickname, setNickname] = useState('');

  const trimmed = nickname.trim();
  const isValid = trimmed.length >= 2 && trimmed.length <= 20;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isValid) onStart(trimmed);
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className="eyebrow">Get ready</p>
        <h1 className={styles.title}>{quizTitle}</h1>
        <p className={styles.hint}>Enter a nickname to appear on the leaderboard.</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="nickname" className={styles.label}>Your nickname</label>
            <input
              id="nickname"
              type="text"
              className={styles.input}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. QuizMaster99"
              maxLength={20}
              autoFocus
              autoComplete="off"
            />
            <span className={styles.charCount}>{trimmed.length}/20</span>
          </div>

          <div className={styles.actions}>
            <button type="button" className="btn-secondary" onClick={onBack}>
              ← Back
            </button>
            <button type="submit" className="btn-primary" disabled={!isValid}>
              Start Quiz →
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
