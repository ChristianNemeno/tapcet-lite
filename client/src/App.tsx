import { useState } from 'react';

import HomePage from './pages/HomePage';
import NicknamePage from './pages/NicknamePage';
import QuizPage from './pages/QuizPage';
import ResultsPage from './pages/ResultsPage';
import type { SubmitQuizResponse } from './types';

type AppState =
  | { view: 'home' }
  | { view: 'nickname'; quizId: string; quizTitle: string; timeLimitSeconds: number | null }
  | { view: 'quiz'; quizId: string; nickname: string; timeLimitSeconds: number | null }
  | { view: 'results'; results: SubmitQuizResponse };

export default function App() {
  const [state, setState] = useState<AppState>({ view: 'home' });

  if (state.view === 'nickname') {
    return (
      <NicknamePage
        quizId={state.quizId}
        quizTitle={state.quizTitle}
        onBack={() => setState({ view: 'home' })}
        onStart={(nickname) =>
          setState({
            view: 'quiz',
            quizId: state.quizId,
            nickname,
            timeLimitSeconds: state.timeLimitSeconds,
          })
        }
      />
    );
  }

  if (state.view === 'quiz') {
    return (
      <QuizPage
        quizId={state.quizId}
        nickname={state.nickname}
        timeLimitSeconds={state.timeLimitSeconds}
        onResults={(results) => setState({ view: 'results', results })}
      />
    );
  }

  if (state.view === 'results') {
    return (
      <ResultsPage
        results={state.results}
        onPlayAgain={() => setState({ view: 'home' })}
      />
    );
  }

  return (
    <HomePage
      onSelectQuiz={(quizId, quizTitle, timeLimitSeconds) =>
        setState({ view: 'nickname', quizId, quizTitle, timeLimitSeconds })
      }
    />
  );
}
