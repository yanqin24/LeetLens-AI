export type ReviewPlanType = "default" | "custom";

export type ReviewTaskStatus = "todo" | "in_progress" | "done" | "failed_today" | "skipped";

export type ReviewTaskSource = "auto" | "manual" | "filter";

export type ReviewPlan = {
  id: string;
  name: string;
  type: ReviewPlanType;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReviewTask = {
  id: string;
  planId: string;
  problemId: string;
  scheduledFor: string;
  status: ReviewTaskStatus;
  source: ReviewTaskSource;
  latestAttemptId?: string;
  openedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};
