import type { ProblemInput } from "./problem";
import type { SubmissionAttemptInput } from "./attempt";
import type { ReviewResult } from "./review";

export type CaptureFailedSubmissionMessage = {
  type: "CAPTURE_FAILED_SUBMISSION";
  payload: {
    problem: ProblemInput;
    attempt: SubmissionAttemptInput;
  };
};

export type UpdateMistakeReasonMessage = {
  type: "UPDATE_MISTAKE_REASON";
  payload: {
    mistakeRecordId: string;
    primaryReason: string;
    secondaryReason?: string;
    note?: string;
  };
};

export type DiscardCapturedSubmissionMessage = {
  type: "DISCARD_CAPTURED_SUBMISSION";
  payload: {
    problemId: string;
    attemptId: string;
    mistakeRecordId: string;
  };
};

export type GetDashboardSummaryMessage = {
  type: "GET_DASHBOARD_SUMMARY";
};

export type UpdateReviewStateMessage = {
  type: "UPDATE_REVIEW_STATE";
  payload: {
    problemId: string;
    result: ReviewResult;
    note?: string;
  };
};

export type ClearAllDataMessage = {
  type: "CLEAR_ALL_DATA";
};

export type ExtensionMessage =
  | CaptureFailedSubmissionMessage
  | UpdateMistakeReasonMessage
  | DiscardCapturedSubmissionMessage
  | GetDashboardSummaryMessage
  | UpdateReviewStateMessage
  | ClearAllDataMessage;

export type CaptureFailedSubmissionResponse = {
  problemId: string;
  attemptId: string;
  mistakeRecordId: string;
  duplicate: boolean;
};
