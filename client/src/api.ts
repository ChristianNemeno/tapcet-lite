import type {
  AnswersMap,
  LeaderboardEntry,
  QuizResponse,
  QuizSummary,
  SubmitQuizResponse,
} from './types';

async function parseResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export async function fetchQuizzes(): Promise<QuizSummary[]> {
  const response = await fetch('/api/quizzes');
  return parseResponse<QuizSummary[]>(response, 'Failed to load quizzes.');
}

export async function fetchQuiz(id: string): Promise<QuizResponse> {
  const response = await fetch(`/api/quiz/${id}`);
  return parseResponse<QuizResponse>(response, 'Failed to load quiz.');
}

export async function submitQuiz(
  id: string,
  answers: AnswersMap,
  nickname?: string,
): Promise<SubmitQuizResponse> {
  const response = await fetch(`/api/quiz/${id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, nickname }),
  });

  return parseResponse<SubmitQuizResponse>(response, 'Failed to submit quiz.');
}

export async function fetchLeaderboard(id: string): Promise<LeaderboardEntry[]> {
  const response = await fetch(`/api/quiz/${id}/leaderboard`);
  return parseResponse<LeaderboardEntry[]>(response, 'Failed to load leaderboard.');
}
