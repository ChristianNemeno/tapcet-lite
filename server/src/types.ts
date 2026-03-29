export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  orderIndex: number;
}

export interface QuizResponse {
  id: string;
  title: string;
  questions: QuizQuestion[];
}

export type AnswersMap = Record<string, number>;

export interface SubmitQuizRequest {
  answers: AnswersMap;
}

export interface QuizResultItem {
  questionId: string;
  questionText: string;
  options: string[];
  correct: boolean;
  selectedAnswer: number | null;
  correctAnswer: number;
}

export interface SubmitQuizResponse {
  score: number;
  total: number;
  percentage: number;
  results: QuizResultItem[];
}
