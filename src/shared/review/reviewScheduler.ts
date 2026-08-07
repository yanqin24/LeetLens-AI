import type { ReviewState } from "../types/review";
import type { ReviewTask } from "../types/reviewPlan";
import { addDaysIso } from "../utils/date";

export type SchedulerOutcome = "accepted" | "failed";

export type ReviewScheduleDecision = {
  reviewState: ReviewState;
  nextTask?: {
    scheduledFor: string;
    status: ReviewTask["status"];
    source: ReviewTask["source"];
  };
};

const SUCCESS_INTERVAL_BY_MASTERY: Record<ReviewState["mastery"], number> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30
};

const FAILURE_REVIEW_INTERVAL_DAYS = 1;
const MASTERY_CAP = 5;
const MASTERY_FLOOR = 1;

export function scheduleAfterReview(input: {
  reviewState: ReviewState;
  outcome: SchedulerOutcome;
  reviewedAt: string;
}): ReviewScheduleDecision {
  return input.outcome === "accepted"
    ? scheduleAfterAccepted(input.reviewState, input.reviewedAt)
    : scheduleAfterFailed(input.reviewState, input.reviewedAt);
}

function scheduleAfterAccepted(reviewState: ReviewState, reviewedAt: string): ReviewScheduleDecision {
  const positiveStreak = reviewState.positiveStreak + 1;
  const mastery = clampMastery(reviewState.mastery + 1);
  const mastered = mastery >= 4 && positiveStreak >= 2;
  const nextReviewAt = addDaysIso(reviewedAt, SUCCESS_INTERVAL_BY_MASTERY[mastery]);
  const updatedReviewState: ReviewState = {
    ...reviewState,
    status: mastered ? "mastered" : "scheduled",
    mastery,
    scheduleMode: reviewState.scheduleMode === "manual" ? "manual" : "auto",
    nextReviewAt,
    lastReviewedAt: reviewedAt,
    reviewCount: reviewState.reviewCount + 1,
    positiveStreak,
    updatedAt: reviewedAt
  };

  return {
    reviewState: updatedReviewState,
    nextTask: mastered
      ? undefined
      : {
          scheduledFor: nextReviewAt,
          status: "todo",
          source: "auto"
        }
  };
}

function scheduleAfterFailed(reviewState: ReviewState, reviewedAt: string): ReviewScheduleDecision {
  const nextReviewAt = addDaysIso(reviewedAt, FAILURE_REVIEW_INTERVAL_DAYS);
  const updatedReviewState: ReviewState = {
    ...reviewState,
    status: "scheduled",
    mastery: clampMastery(reviewState.mastery - 1),
    scheduleMode: "auto",
    nextReviewAt,
    lastReviewedAt: reviewedAt,
    reviewCount: reviewState.reviewCount + 1,
    positiveStreak: 0,
    updatedAt: reviewedAt
  };

  return {
    reviewState: updatedReviewState,
    nextTask: {
      scheduledFor: nextReviewAt,
      status: "todo",
      source: "auto"
    }
  };
}

function clampMastery(value: number): ReviewState["mastery"] {
  return Math.min(MASTERY_CAP, Math.max(MASTERY_FLOOR, value)) as ReviewState["mastery"];
}
