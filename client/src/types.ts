export interface QuizSummary {
  id: string;
  title: string;
  description: string;
  timeLimitSeconds: number | null;
  questionCount: number;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  orderIndex: number;
}

export interface QuizResponse {
  id: string;
  title: string;
  description: string;
  timeLimitSeconds: number | null;
  questions: QuizQuestion[];
}

export type AnswersMap = Record<string, number>;

export interface SubmitQuizRequest {
  answers: AnswersMap;
  nickname?: string;
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
  quizId: string;
  nickname: string | null;
}

export interface LeaderboardEntry {
  id: string;
  nickname: string;
  score: number;
  total: number;
  percentage: number;
  completedAt: string;
}
