import type { SubmissionAttempt } from "../../types/attempt";
import type { MistakeRecord } from "../../types/mistake";
import type { Problem } from "../../types/problem";
import type { ReviewLog, ReviewState } from "../../types/review";
import type { ReviewPlan, ReviewTask } from "../../types/reviewPlan";
import { db, type IgnoredProblem, type SettingRecord } from "../schema";

const PORTABLE_DATA_APP_NAME = "LeetLens";
const PORTABLE_DATA_VERSION = 2;

export type PortableDataSnapshot = {
  app: typeof PORTABLE_DATA_APP_NAME;
  schemaVersion: number;
  exportedAt: string;
  data: {
    problems: Problem[];
    attempts: SubmissionAttempt[];
    mistakes: MistakeRecord[];
    reviewStates: ReviewState[];
    reviewLogs: ReviewLog[];
    reviewPlans: ReviewPlan[];
    reviewTasks: ReviewTask[];
    settings: SettingRecord[];
    ignoredProblems: IgnoredProblem[];
  };
};

export async function exportPortableData(): Promise<PortableDataSnapshot> {
  const [
    problems,
    attempts,
    mistakes,
    reviewStates,
    reviewLogs,
    reviewPlans,
    reviewTasks,
    settings,
    ignoredProblems
  ] = await Promise.all([
    db.problems.toArray(),
    db.attempts.toArray(),
    db.mistakes.toArray(),
    db.reviewStates.toArray(),
    db.reviewLogs.toArray(),
    db.reviewPlans.toArray(),
    db.reviewTasks.toArray(),
    db.settings.toArray(),
    db.ignoredProblems.toArray()
  ]);

  return {
    app: PORTABLE_DATA_APP_NAME,
    schemaVersion: PORTABLE_DATA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      problems,
      attempts,
      mistakes,
      reviewStates,
      reviewLogs,
      reviewPlans,
      reviewTasks,
      settings,
      ignoredProblems
    }
  };
}

export async function importPortableData(input: unknown): Promise<PortableDataSnapshot["data"]> {
  const snapshot = parsePortableDataSnapshot(input);

  await db.transaction(
    "rw",
    [
      db.problems,
      db.attempts,
      db.mistakes,
      db.reviewStates,
      db.reviewLogs,
      db.reviewPlans,
      db.reviewTasks,
      db.settings,
      db.ignoredProblems
    ],
    async () => {
      await Promise.all([
        db.problems.bulkPut(snapshot.data.problems),
        db.attempts.bulkPut(snapshot.data.attempts),
        db.mistakes.bulkPut(snapshot.data.mistakes),
        db.reviewStates.bulkPut(snapshot.data.reviewStates),
        db.reviewLogs.bulkPut(snapshot.data.reviewLogs),
        db.reviewPlans.bulkPut(snapshot.data.reviewPlans),
        db.reviewTasks.bulkPut(snapshot.data.reviewTasks),
        db.settings.bulkPut(snapshot.data.settings),
        db.ignoredProblems.bulkPut(snapshot.data.ignoredProblems)
      ]);
    }
  );

  return snapshot.data;
}

function parsePortableDataSnapshot(input: unknown): PortableDataSnapshot {
  if (!isRecord(input)) {
    throw new Error("Invalid LeetLens export file.");
  }

  if (input.app !== PORTABLE_DATA_APP_NAME || !isRecord(input.data)) {
    throw new Error("This file is not a LeetLens JSON export.");
  }

  return {
    app: PORTABLE_DATA_APP_NAME,
    schemaVersion: typeof input.schemaVersion === "number" ? input.schemaVersion : 1,
    exportedAt: typeof input.exportedAt === "string" ? input.exportedAt : new Date().toISOString(),
    data: {
      problems: readArray<Problem>(input.data.problems),
      attempts: readArray<SubmissionAttempt>(input.data.attempts),
      mistakes: readArray<MistakeRecord>(input.data.mistakes),
      reviewStates: readArray<ReviewState>(input.data.reviewStates),
      reviewLogs: readArray<ReviewLog>(input.data.reviewLogs),
      reviewPlans: readArray<ReviewPlan>(input.data.reviewPlans),
      reviewTasks: readArray<ReviewTask>(input.data.reviewTasks),
      settings: readArray<SettingRecord>(input.data.settings),
      ignoredProblems: readArray<IgnoredProblem>(input.data.ignoredProblems)
    }
  };
}

function readArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
