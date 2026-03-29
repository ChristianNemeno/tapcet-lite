import { useState } from 'react';

import ResultsPage from './pages/ResultsPage';
import QuizPage from './pages/QuizPage';
import type { SubmitQuizResponse } from './types';

export default function App() {
  const [results, setResults] = useState<SubmitQuizResponse | null>(null);

  return results ? (
    <ResultsPage results={results} onRetry={() => setResults(null)} />
  ) : (
    <QuizPage onResults={setResults} />
  );
}
