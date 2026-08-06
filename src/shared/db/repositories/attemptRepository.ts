import { db } from "../schema";
import type { SubmissionAttempt, SubmissionAttemptInput } from "../../types/attempt";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/date";

export async function createAttempt(
  problemId: string,
  input: SubmissionAttemptInput
): Promise<SubmissionAttempt> {
  const attempt: SubmissionAttempt = {
    ...input,
    id: createId("attempt"),
    problemId,
    submittedAt: input.submittedAt ?? nowIso()
  };

  await db.attempts.add(attempt);
  return attempt;
}

export async function findRecentAttemptByFingerprint(
  fingerprint: string,
  withinMs: number
): Promise<SubmissionAttempt | undefined> {
  const cutoff = Date.now() - withinMs;
  const attempt = await db.attempts.where("fingerprint").equals(fingerprint).first();

  if (!attempt) {
    return undefined;
  }

  return new Date(attempt.submittedAt).getTime() >= cutoff ? attempt : undefined;
}

export async function listAttemptsForProblem(problemId: string): Promise<SubmissionAttempt[]> {
  return db.attempts.where("problemId").equals(problemId).reverse().sortBy("submittedAt");
}
