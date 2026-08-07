import { db } from "../schema";
import type { ReviewLog, ReviewState } from "../../types/review";
import type { ReviewTask } from "../../types/reviewPlan";
import { scheduleAfterReview, type SchedulerOutcome } from "../../review/reviewScheduler";
import { nowIso } from "../../utils/date";
import { createId } from "../../utils/ids";

export async function markReviewTaskDone(input: {
  taskId: string;
  problemId: string;
}): Promise<void> {
  await applyReviewTaskOutcome({
    ...input,
    outcome: "accepted",
    taskStatus: "done"
  });
}

export async function markReviewTaskFailed(input: {
  taskId: string;
  problemId: string;
}): Promise<void> {
  await applyReviewTaskOutcome({
    ...input,
    outcome: "failed",
    taskStatus: "failed_today"
  });
}

async function applyReviewTaskOutcome(input: {
  taskId: string;
  problemId: string;
  outcome: SchedulerOutcome;
  taskStatus: ReviewTask["status"];
}): Promise<void> {
  const now = nowIso();
  const reviewState = await db.reviewStates.where("problemId").equals(input.problemId).first();
  const task = await db.reviewTasks.get(input.taskId);

  if (!reviewState || !task) {
    return;
  }

  const decision = scheduleAfterReview({
    reviewState,
    outcome: input.outcome,
    reviewedAt: now
  });
  const log = createReviewLog({
    problemId: input.problemId,
    outcome: input.outcome,
    reviewedAt: now,
    task
  });

  await db.transaction("rw", [db.reviewTasks, db.reviewStates, db.reviewLogs], async () => {
    await db.reviewTasks.update(input.taskId, {
      status: input.taskStatus,
      completedAt: input.taskStatus === "done" ? now : undefined,
      updatedAt: now
    });
    await db.reviewStates.put(decision.reviewState);
    await db.reviewLogs.add(log);

    if (decision.nextTask) {
      await upsertAutoReviewTask({
        currentTask: task,
        decision: decision.nextTask,
        problemId: input.problemId,
        now
      });
    }
  });
}

function createReviewLog(input: {
  problemId: string;
  outcome: SchedulerOutcome;
  reviewedAt: string;
  task: ReviewTask;
}): ReviewLog {
  return {
    id: createId("reviewlog"),
    problemId: input.problemId,
    reviewedAt: input.reviewedAt,
    result: input.outcome === "accepted" ? "solved_again" : "failed_again",
    source: input.task.source === "manual" ? "manual" : "daily_review"
  };
}

async function upsertAutoReviewTask(input: {
  currentTask: ReviewTask;
  decision: {
    scheduledFor: string;
    status: ReviewTask["status"];
    source: ReviewTask["source"];
  };
  problemId: string;
  now: string;
}): Promise<void> {
  const scheduledDate = toDateKey(input.decision.scheduledFor);
  const existingTask = await db.reviewTasks
    .filter(
      (task) =>
        task.id !== input.currentTask.id &&
        task.planId === input.currentTask.planId &&
        task.problemId === input.problemId &&
        toDateKey(task.scheduledFor) === scheduledDate
    )
    .first();

  if (existingTask) {
    await db.reviewTasks.update(existingTask.id, {
      status: "todo",
      scheduledFor: input.decision.scheduledFor,
      source: input.decision.source,
      latestAttemptId: input.currentTask.latestAttemptId,
      updatedAt: input.now
    });
    return;
  }

  await db.reviewTasks.add({
    id: createId("review_task"),
    planId: input.currentTask.planId,
    problemId: input.problemId,
    scheduledFor: input.decision.scheduledFor,
    status: input.decision.status,
    source: input.decision.source,
    latestAttemptId: input.currentTask.latestAttemptId,
    createdAt: input.now,
    updatedAt: input.now
  });
}

function toDateKey(dateIso: string): string {
  const date = new Date(dateIso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
