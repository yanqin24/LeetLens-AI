import { db } from "../schema";
import type { ReviewLog, ReviewResult, ReviewState } from "../../types/review";
import { addDaysIso, nowIso } from "../../utils/date";
import { createId } from "../../utils/ids";

export async function ensureReviewState(problemId: string, submittedAt: string): Promise<ReviewState> {
  const existing = await db.reviewStates.where("problemId").equals(problemId).first();

  if (existing) {
    return existing;
  }

  const reviewState: ReviewState = {
    id: createId("review"),
    problemId,
    status: "to_review",
    mastery: 1,
    nextReviewAt: addDaysIso(submittedAt, 1),
    reviewCount: 0,
    positiveStreak: 0
  };

  await db.reviewStates.add(reviewState);
  return reviewState;
}

export async function updateReviewAfterResult(
  problemId: string,
  result: ReviewResult,
  note?: string
): Promise<ReviewState> {
  const now = nowIso();
  const existing = await db.reviewStates.where("problemId").equals(problemId).first();

  if (!existing) {
    throw new Error(`Review state not found for problem ${problemId}`);
  }

  const positive = result === "remembered" || result === "solved_again";
  const dayDeltaByResult: Record<ReviewResult, number> = {
    failed_again: 1,
    forgot: 1,
    partially_remembered: 3,
    remembered: 7,
    solved_again: 7
  };

  const masteryDeltaByResult: Record<ReviewResult, number> = {
    failed_again: -1,
    forgot: -1,
    partially_remembered: 1,
    remembered: 1,
    solved_again: 2
  };

  const nextMastery = Math.min(
    5,
    Math.max(1, existing.mastery + masteryDeltaByResult[result])
  ) as ReviewState["mastery"];
  const positiveStreak = positive ? existing.positiveStreak + 1 : 0;
  const status = nextMastery >= 4 && positiveStreak >= 2 ? "mastered" : "to_review";

  const updated: ReviewState = {
    ...existing,
    mastery: nextMastery,
    status,
    nextReviewAt: addDaysIso(now, dayDeltaByResult[result]),
    lastReviewedAt: now,
    reviewCount: existing.reviewCount + 1,
    positiveStreak
  };

  const log: ReviewLog = {
    id: createId("reviewlog"),
    problemId,
    reviewedAt: now,
    result,
    note
  };

  await db.transaction("rw", db.reviewStates, db.reviewLogs, async () => {
    await db.reviewStates.put(updated);
    await db.reviewLogs.add(log);
  });

  return updated;
}

export async function listDueReviewStates(): Promise<ReviewState[]> {
  return db.reviewStates
    .where("nextReviewAt")
    .belowOrEqual(nowIso())
    .filter((reviewState) => reviewState.status !== "mastered")
    .toArray();
}
