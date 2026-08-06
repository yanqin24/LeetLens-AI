import type { CaptureFailedSubmissionResponse } from "../../types/messages";
import type { ProblemInput } from "../../types/problem";
import type { SubmissionAttemptInput } from "../../types/attempt";
import { createAttempt, findRecentAttemptByFingerprint } from "./attemptRepository";
import { createUncategorizedMistake } from "./mistakeRepository";
import { upsertProblem } from "./problemRepository";
import { ensureReviewState } from "./reviewRepository";
import { db } from "../schema";

const DEDUPE_WINDOW_MS = 10 * 60_000;

export async function captureFailedSubmission(
  problemInput: ProblemInput,
  attemptInput: SubmissionAttemptInput
): Promise<CaptureFailedSubmissionResponse> {
  const duplicateAttempt = await findRecentAttemptByFingerprint(
    attemptInput.fingerprint,
    DEDUPE_WINDOW_MS
  );

  if (duplicateAttempt) {
    return {
      problemId: duplicateAttempt.problemId,
      attemptId: duplicateAttempt.id,
      mistakeRecordId: "",
      duplicate: true
    };
  }

  const problem = await upsertProblem(problemInput);
  const attempt = await createAttempt(problem.id, attemptInput);
  const mistake = await createUncategorizedMistake(problem.id, attempt.id);
  await ensureReviewState(problem.id, attempt.submittedAt);

  return {
    problemId: problem.id,
    attemptId: attempt.id,
    mistakeRecordId: mistake.id,
    duplicate: false
  };
}

export async function discardCapturedSubmission(input: {
  problemId: string;
  attemptId: string;
  mistakeRecordId: string;
}): Promise<void> {
  await db.transaction(
    "rw",
    db.problems,
    db.attempts,
    db.mistakes,
    db.reviewStates,
    db.reviewLogs,
    async () => {
      await db.mistakes.delete(input.mistakeRecordId);
      await db.attempts.delete(input.attemptId);

      const [remainingAttempts, remainingMistakes, reviewLogs] = await Promise.all([
        db.attempts.where("problemId").equals(input.problemId).count(),
        db.mistakes.where("problemId").equals(input.problemId).count(),
        db.reviewLogs.where("problemId").equals(input.problemId).count()
      ]);

      if (remainingAttempts === 0 && remainingMistakes === 0 && reviewLogs === 0) {
        const reviewState = await db.reviewStates.where("problemId").equals(input.problemId).first();

        if (reviewState) {
          await db.reviewStates.delete(reviewState.id);
        }

        await db.problems.delete(input.problemId);
      }
    }
  );
}
