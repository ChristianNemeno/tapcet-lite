import type {
  AnswersMap,
  QuizResponse,
  SubmitQuizRequest,
  SubmitQuizResponse,
} from './types';

async function parseResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export async function fetchQuiz(): Promise<QuizResponse> {
  const response = await fetch('/api/quiz');
  return parseResponse<QuizResponse>(response, 'Failed to load quiz.');
}

export async function submitQuiz(answers: AnswersMap): Promise<SubmitQuizResponse> {
  const payload: SubmitQuizRequest = { answers };
  const response = await fetch('/api/quiz/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse<SubmitQuizResponse>(response, 'Failed to submit quiz.');
}
