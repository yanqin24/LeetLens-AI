export type ReviewStatus = "new" | "to_review" | "reviewing" | "mastered";

export type ReviewResult =
  | "remembered"
  | "partially_remembered"
  | "forgot"
  | "solved_again"
  | "failed_again";

export type ReviewState = {
  id: string;
  problemId: string;
  status: ReviewStatus;
  mastery: 1 | 2 | 3 | 4 | 5;
  nextReviewAt: string;
  lastReviewedAt?: string;
  reviewCount: number;
  positiveStreak: number;
};

export type ReviewLog = {
  id: string;
  problemId: string;
  reviewedAt: string;
  result: ReviewResult;
  note?: string;
};
