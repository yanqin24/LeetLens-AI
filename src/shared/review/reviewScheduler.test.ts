import { describe, expect, it } from "vitest";
import type { ReviewState } from "../types/review";
import { scheduleAfterReview } from "./reviewScheduler";

const REVIEWED_AT = "2026-08-07T12:00:00.000Z";

describe("scheduleAfterReview", () => {
  it("schedules a next-day review and lowers mastery after a failed review", () => {
    const decision = scheduleAfterReview({
      reviewState: createReviewState({ mastery: 3, positiveStreak: 2, reviewCount: 4 }),
      outcome: "failed",
      reviewedAt: REVIEWED_AT
    });

    expect(decision.reviewState.mastery).toBe(2);
    expect(decision.reviewState.positiveStreak).toBe(0);
    expect(decision.reviewState.reviewCount).toBe(5);
    expect(decision.reviewState.status).toBe("scheduled");
    expect(decision.reviewState.nextReviewAt).toBe("2026-08-08T12:00:00.000Z");
    expect(decision.nextTask).toEqual({
      scheduledFor: "2026-08-08T12:00:00.000Z",
      status: "todo",
      source: "auto"
    });
  });

  it("increases mastery and schedules a future review after an accepted review", () => {
    const decision = scheduleAfterReview({
      reviewState: createReviewState({ mastery: 2, positiveStreak: 0, reviewCount: 1 }),
      outcome: "accepted",
      reviewedAt: REVIEWED_AT
    });

    expect(decision.reviewState.mastery).toBe(3);
    expect(decision.reviewState.positiveStreak).toBe(1);
    expect(decision.reviewState.reviewCount).toBe(2);
    expect(decision.reviewState.status).toBe("scheduled");
    expect(decision.reviewState.nextReviewAt).toBe("2026-08-14T12:00:00.000Z");
    expect(decision.nextTask).toEqual({
      scheduledFor: "2026-08-14T12:00:00.000Z",
      status: "todo",
      source: "auto"
    });
  });

  it("marks a problem as mastered and does not create a next task after enough accepted reviews", () => {
    const decision = scheduleAfterReview({
      reviewState: createReviewState({ mastery: 3, positiveStreak: 1, reviewCount: 5 }),
      outcome: "accepted",
      reviewedAt: REVIEWED_AT
    });

    expect(decision.reviewState.mastery).toBe(4);
    expect(decision.reviewState.positiveStreak).toBe(2);
    expect(decision.reviewState.status).toBe("mastered");
    expect(decision.nextTask).toBeUndefined();
  });

  it("does not lower mastery below one after repeated failures", () => {
    const decision = scheduleAfterReview({
      reviewState: createReviewState({ mastery: 1, positiveStreak: 0, reviewCount: 8 }),
      outcome: "failed",
      reviewedAt: REVIEWED_AT
    });

    expect(decision.reviewState.mastery).toBe(1);
    expect(decision.reviewState.nextReviewAt).toBe("2026-08-08T12:00:00.000Z");
  });

  it("preserves manual schedule mode after an accepted manual review", () => {
    const decision = scheduleAfterReview({
      reviewState: createReviewState({ mastery: 1, scheduleMode: "manual" }),
      outcome: "accepted",
      reviewedAt: REVIEWED_AT
    });

    expect(decision.reviewState.scheduleMode).toBe("manual");
    expect(decision.nextTask?.source).toBe("auto");
  });
});

function createReviewState(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    id: "review_test",
    problemId: "problem_test",
    status: "scheduled",
    mastery: 2,
    scheduleMode: "auto",
    nextReviewAt: "2026-08-07T12:00:00.000Z",
    reviewCount: 0,
    positiveStreak: 0,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
    ...overrides
  };
}
