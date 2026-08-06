import { db } from "../schema";
import { addDaysIso, nowIso } from "../../utils/date";

export async function markReviewTaskDone(input: {
  taskId: string;
  problemId: string;
}): Promise<void> {
  const now = nowIso();
  const reviewState = await db.reviewStates.where("problemId").equals(input.problemId).first();

  await db.transaction("rw", [db.reviewTasks, db.reviewStates], async () => {
    await db.reviewTasks.update(input.taskId, {
      status: "done",
      completedAt: now,
      updatedAt: now
    });

    if (reviewState) {
      const nextMastery = Math.min(5, reviewState.mastery + 1) as typeof reviewState.mastery;
      await db.reviewStates.put({
        ...reviewState,
        status: nextMastery >= 4 && reviewState.positiveStreak + 1 >= 2 ? "mastered" : "scheduled",
        mastery: nextMastery,
        scheduleMode: "auto",
        nextReviewAt: addDaysIso(now, nextMastery >= 4 ? 14 : 7),
        lastReviewedAt: now,
        reviewCount: reviewState.reviewCount + 1,
        positiveStreak: reviewState.positiveStreak + 1,
        updatedAt: now
      });
    }
  });
}

export async function markReviewTaskFailed(input: {
  taskId: string;
  problemId: string;
}): Promise<void> {
  const now = nowIso();
  const reviewState = await db.reviewStates.where("problemId").equals(input.problemId).first();

  await db.transaction("rw", [db.reviewTasks, db.reviewStates], async () => {
    await db.reviewTasks.update(input.taskId, {
      status: "failed_today",
      updatedAt: now
    });

    if (reviewState) {
      await db.reviewStates.put({
        ...reviewState,
        status: "scheduled",
        mastery: Math.max(1, reviewState.mastery - 1) as typeof reviewState.mastery,
        scheduleMode: "auto",
        nextReviewAt: addDaysIso(now, 1),
        lastReviewedAt: now,
        reviewCount: reviewState.reviewCount + 1,
        positiveStreak: 0,
        updatedAt: now
      });
    }
  });
}
