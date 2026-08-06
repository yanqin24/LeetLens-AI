import Dexie, { type Table } from "dexie";
import type { SubmissionAttempt } from "../types/attempt";
import type { MistakeRecord } from "../types/mistake";
import type { Problem } from "../types/problem";
import type { ReviewLog, ReviewState } from "../types/review";

export type SettingRecord = {
  key: string;
  value: unknown;
};

export type IgnoredProblem = {
  slug: string;
  createdAt: string;
};

export class LeetLensDatabase extends Dexie {
  problems!: Table<Problem, string>;
  attempts!: Table<SubmissionAttempt, string>;
  mistakes!: Table<MistakeRecord, string>;
  reviewStates!: Table<ReviewState, string>;
  reviewLogs!: Table<ReviewLog, string>;
  settings!: Table<SettingRecord, string>;
  ignoredProblems!: Table<IgnoredProblem, string>;

  constructor() {
    super("LeetLensDatabase");

    this.version(1).stores({
      problems: "id, leetcodeId, slug, difficulty, lastSeenAt",
      attempts: "id, problemId, submittedAt, result, language, fingerprint",
      mistakes: "id, problemId, attemptId, primaryReason, secondaryReason, confidence, createdAt",
      reviewStates: "id, problemId, status, mastery, nextReviewAt",
      reviewLogs: "id, problemId, reviewedAt, result",
      settings: "key",
      ignoredProblems: "slug"
    });
  }
}

export const db = new LeetLensDatabase();
