export type SubmissionResult =
  | "Wrong Answer"
  | "Time Limit Exceeded"
  | "Runtime Error"
  | "Compile Error"
  | "Accepted";

export type CodeCaptureStatus = "success" | "partial" | "failed";

export type SubmissionAttempt = {
  id: string;
  problemId: string;
  submittedAt: string;
  language: string;
  code: string;
  result: SubmissionResult;
  errorMessage?: string;
  failedTestCase?: string;
  expectedOutput?: string;
  actualOutput?: string;
  codeCaptureStatus: CodeCaptureStatus;
  fingerprint: string;
};

export type SubmissionAttemptInput = Omit<SubmissionAttempt, "id" | "problemId" | "submittedAt"> & {
  submittedAt?: string;
};
