import { db } from "../schema";
import type { ManualReviewReason, ReviewLog, ReviewResult, ReviewState } from "../../types/review";
import { addDaysIso, addDaysToNowIso, dateInputToIso, nowIso } from "../../utils/date";
import { createId } from "../../utils/ids";

export async function ensureReviewState(problemId: string, submittedAt: string): Promise<ReviewState> {
  const existing = await db.reviewStates.where("problemId").equals(problemId).first();
  const now = nowIso();

  if (existing) {
    const normalized: ReviewState = {
      ...existing,
      scheduleMode: existing.scheduleMode ?? "auto",
      status: normalizeActiveStatus(existing.status),
      updatedAt: now
    };

    await db.reviewStates.put(normalized);
    return normalized;
  }

  const reviewState: ReviewState = {
    id: createId("review"),
    problemId,
    status: "scheduled",
    mastery: 1,
    scheduleMode: "auto",
    nextReviewAt: addDaysIso(submittedAt, 1),
    reviewCount: 0,
    positiveStreak: 0,
    createdAt: now,
    updatedAt: now
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
  const repeatActive = isDailyRepeatActive(existing, now);
  const dayDeltaByResult: Record<ReviewResult, number> = {
    failed_again: 1,
    forgot: 1,
    partially_remembered: 3,
    remembered: 7,
    solved_again: 14
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
  const mastered = nextMastery >= 4 && positiveStreak >= 2;
  const nextAutoReviewAt = addDaysIso(now, dayDeltaByResult[result]);
  const nextReviewAt = repeatActive ? addDaysIso(now, 1) : nextAutoReviewAt;
  const status = mastered && !repeatActive ? "mastered" : "scheduled";

  const updated: ReviewState = {
    ...existing,
    mastery: nextMastery,
    status,
    scheduleMode: repeatActive ? "manual" : "auto",
    nextReviewAt,
    lastReviewedAt: now,
    reviewCount: existing.reviewCount + 1,
    positiveStreak,
    manualReviewAt: repeatActive ? nextReviewAt : undefined,
    manualReason: repeatActive ? "daily_drill" : undefined,
    repeatType: repeatActive ? existing.repeatType : undefined,
    repeatStartAt: repeatActive ? existing.repeatStartAt : undefined,
    repeatUntil: repeatActive ? existing.repeatUntil : undefined,
    updatedAt: now
  };

  const log: ReviewLog = {
    id: createId("reviewlog"),
    problemId,
    reviewedAt: now,
    result,
    source: repeatActive || existing.scheduleMode === "manual" ? "manual" : "daily_review",
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
    .filter((reviewState) => isReviewDue(reviewState))
    .toArray();
}

export async function scheduleReviewForToday(problemId: string): Promise<ReviewState> {
  return setManualReview(problemId, nowIso(), "today");
}

export async function scheduleReviewForTomorrow(problemId: string): Promise<ReviewState> {
  return setManualReview(problemId, addDaysToNowIso(1), "tomorrow");
}

export async function scheduleReviewForDate(problemId: string, dateInput: string): Promise<ReviewState> {
  return setManualReview(problemId, dateInputToIso(dateInput), "custom");
}

export async function scheduleDailyForSevenDays(problemId: string): Promise<ReviewState> {
  const existing = await getExistingReviewState(problemId);
  const now = nowIso();
  const updated: ReviewState = {
    ...existing,
    status: "scheduled",
    scheduleMode: "manual",
    nextReviewAt: now,
    manualReviewAt: now,
    manualReason: "daily_drill",
    repeatType: "daily",
    repeatStartAt: now,
    repeatUntil: addDaysIso(now, 6),
    updatedAt: now
  };

  await db.reviewStates.put(updated);
  return updated;
}

export async function pauseReview(problemId: string): Promise<ReviewState> {
  const existing = await getExistingReviewState(problemId);
  const updated: ReviewState = {
    ...existing,
    status: "paused",
    scheduleMode: "manual",
    manualReviewAt: undefined,
    manualReason: undefined,
    repeatType: undefined,
    repeatStartAt: undefined,
    repeatUntil: undefined,
    updatedAt: nowIso()
  };

  await db.reviewStates.put(updated);
  return updated;
}

export async function markReviewMastered(problemId: string): Promise<ReviewState> {
  const existing = await getExistingReviewState(problemId);
  const updated: ReviewState = {
    ...existing,
    status: "mastered",
    mastery: 5,
    scheduleMode: "manual",
    manualReviewAt: undefined,
    manualReason: undefined,
    repeatType: undefined,
    repeatStartAt: undefined,
    repeatUntil: undefined,
    updatedAt: nowIso()
  };

  await db.reviewStates.put(updated);
  return updated;
}

async function setManualReview(
  problemId: string,
  reviewAt: string,
  reason: ManualReviewReason
): Promise<ReviewState> {
  const existing = await getExistingReviewState(problemId);
  const updated: ReviewState = {
    ...existing,
    status: "scheduled",
    scheduleMode: "manual",
    nextReviewAt: reviewAt,
    manualReviewAt: reviewAt,
    manualReason: reason,
    repeatType: undefined,
    repeatStartAt: undefined,
    repeatUntil: undefined,
    updatedAt: nowIso()
  };

  await db.reviewStates.put(updated);
  return updated;
}

async function getExistingReviewState(problemId: string): Promise<ReviewState> {
  const existing = await db.reviewStates.where("problemId").equals(problemId).first();

  if (!existing) {
    return ensureReviewState(problemId, nowIso());
  }

  return {
    ...existing,
    scheduleMode: existing.scheduleMode ?? "auto",
    status: normalizeActiveStatus(existing.status)
  };
}

function isReviewDue(reviewState: ReviewState): boolean {
  if (reviewState.status === "mastered" || reviewState.status === "paused") {
    return false;
  }

  return reviewState.nextReviewAt <= nowIso() || isDailyRepeatActive(reviewState, nowIso());
}

function isDailyRepeatActive(reviewState: ReviewState, dateIso: string): boolean {
  return (
    reviewState.repeatType === "daily" &&
    Boolean(reviewState.repeatStartAt) &&
    Boolean(reviewState.repeatUntil) &&
    reviewState.repeatStartAt! <= dateIso &&
    reviewState.repeatUntil! >= dateIso
  );
}

function normalizeActiveStatus(status: ReviewState["status"]): ReviewState["status"] {
  if (status === "to_review" || status === "reviewing") {
    return "scheduled";
  }

  return status;
}
