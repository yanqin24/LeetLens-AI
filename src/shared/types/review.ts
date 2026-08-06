export type ReviewStatus =
  | "new"
  | "due"
  | "scheduled"
  | "mastered"
  | "paused"
  | "to_review"
  | "reviewing";

export type ScheduleMode = "auto" | "manual";

export type ManualReviewReason = "today" | "tomorrow" | "custom" | "daily_drill";

export type RepeatType = "daily";

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
  scheduleMode?: ScheduleMode;
  nextReviewAt: string;
  lastReviewedAt?: string;
  reviewCount: number;
  positiveStreak: number;
  manualReviewAt?: string;
  manualReason?: ManualReviewReason;
  repeatType?: RepeatType;
  repeatStartAt?: string;
  repeatUntil?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ReviewSource = "daily_review" | "manual" | "practice_session";

export type ReviewLog = {
  id: string;
  problemId: string;
  reviewedAt: string;
  result: ReviewResult;
  source?: ReviewSource;
  note?: string;
};
