import { useEffect, useRef, useState } from 'react';

import styles from './Timer.module.css';

interface TimerProps {
  totalSeconds: number;
  onExpire: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Timer({ totalSeconds, onExpire }: TimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (remaining <= 0) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
      return;
    }

    const id = setInterval(() => {
      setRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(id);
  }, [remaining, onExpire]);

  const isUrgent = remaining <= 10;
  const pct = Math.max(0, (remaining / totalSeconds) * 100);

  return (
    <div className={styles.wrapper}>
      <div className={styles.track}>
        <div
          className={`${styles.bar} ${isUrgent ? styles.urgent : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`${styles.label} ${isUrgent ? styles.urgentLabel : ''}`}>
        {formatTime(remaining)}
      </span>
    </div>
  );
}
