import type { SubmissionAttempt } from "../types/attempt";
import type { MistakeRecord } from "../types/mistake";
import type { Problem } from "../types/problem";
import type { ReviewLog, ReviewState } from "../types/review";
import type { ReviewTask } from "../types/reviewPlan";

export type RankedInsight = {
  label: string;
  count: number;
};

export type RecommendedReview = {
  problemId: string;
  title: string;
  leetcodeId?: string;
  reason: string;
  topic: string;
  priority: number;
  nextReviewAt?: string;
};

export type ReviewInsightsSummary = {
  weeklyAttemptCount: number;
  weeklyFailedAttemptCount: number;
  weeklyReviewedCount: number;
  failedAgainCount: number;
  dueTodayCount: number;
  dueTomorrowCount: number;
  dueThisWeekCount: number;
  topMistakeReasons: RankedInsight[];
  weakestTopics: RankedInsight[];
  recommendedReviews: RecommendedReview[];
};

export type ReviewInsightsInput = {
  problems: Problem[];
  attempts: SubmissionAttempt[];
  mistakes: MistakeRecord[];
  reviewLogs: ReviewLog[];
  reviewStates: ReviewState[];
  reviewTasks: ReviewTask[];
  now?: Date;
};

const OPEN_TASK_STATUSES: ReviewTask["status"][] = ["todo", "in_progress", "failed_today"];

export function buildReviewInsightsSummary(input: ReviewInsightsInput): ReviewInsightsSummary {
  const now = input.now ?? new Date();
  const weekStart = startOfWeek(now);
  const todayKey = toDateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = toDateKey(tomorrow);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const problemById = new Map(input.problems.map((problem) => [problem.id, problem]));
  const mistakesByProblemId = groupBy(input.mistakes, (mistake) => mistake.problemId);
  const weeklyAttempts = input.attempts.filter((attempt) => new Date(attempt.submittedAt) >= weekStart);
  const weeklyFailedAttempts = weeklyAttempts.filter((attempt) => attempt.result !== "Accepted");
  const weeklyLogs = input.reviewLogs.filter((log) => new Date(log.reviewedAt) >= weekStart);
  const openTasks = input.reviewTasks.filter((task) => OPEN_TASK_STATUSES.includes(task.status));
  const dueTodayCount = openTasks.filter((task) => toDateKey(new Date(task.scheduledFor)) === todayKey).length;
  const dueTomorrowCount = openTasks.filter((task) => toDateKey(new Date(task.scheduledFor)) === tomorrowKey).length;
  const dueThisWeekCount = openTasks.filter((task) => {
    const scheduledFor = new Date(task.scheduledFor);
    return scheduledFor >= weekStart && scheduledFor < weekEnd;
  }).length;

  return {
    weeklyAttemptCount: weeklyAttempts.length,
    weeklyFailedAttemptCount: weeklyFailedAttempts.length,
    weeklyReviewedCount: weeklyLogs.length,
    failedAgainCount: weeklyLogs.filter((log) => log.result === "failed_again").length,
    dueTodayCount,
    dueTomorrowCount,
    dueThisWeekCount,
    topMistakeReasons: rankMistakeReasons(input.mistakes),
    weakestTopics: rankWeakestTopics(input.problems, input.mistakes),
    recommendedReviews: buildRecommendedReviews({
      problemById,
      mistakesByProblemId,
      reviewStates: input.reviewStates,
      openTasks
    })
  };
}

function rankMistakeReasons(mistakes: MistakeRecord[]): RankedInsight[] {
  return rankCounts(mistakes.map((mistake) => mistake.primaryReason || "Uncategorized"));
}

function rankWeakestTopics(problems: Problem[], mistakes: MistakeRecord[]): RankedInsight[] {
  const problemById = new Map(problems.map((problem) => [problem.id, problem]));
  const topics = mistakes.map((mistake) => problemById.get(mistake.problemId)?.tags[0] ?? "Unknown");

  return rankCounts(topics);
}

function buildRecommendedReviews(input: {
  problemById: Map<string, Problem>;
  mistakesByProblemId: Map<string, MistakeRecord[]>;
  reviewStates: ReviewState[];
  openTasks: ReviewTask[];
}): RecommendedReview[] {
  const openTaskByProblemId = new Map(input.openTasks.map((task) => [task.problemId, task]));
  const recommendations: RecommendedReview[] = [];

  for (const reviewState of input.reviewStates) {
    const problem = input.problemById.get(reviewState.problemId);

    if (!problem || reviewState.status === "mastered" || reviewState.status === "paused") {
      continue;
    }

    const mistakes = input.mistakesByProblemId.get(reviewState.problemId) ?? [];
    const latestMistake = [...mistakes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const openTask = openTaskByProblemId.get(reviewState.problemId);
    const priority =
      (6 - reviewState.mastery) * 10 +
      mistakes.length * 3 +
      (openTask?.status === "failed_today" ? 12 : 0) +
      (openTask ? 6 : 0);

    recommendations.push({
      problemId: problem.id,
      title: problem.title,
      leetcodeId: problem.leetcodeId,
      reason: latestMistake?.primaryReason ?? "Uncategorized",
      topic: problem.tags[0] ?? "Unknown",
      priority,
      nextReviewAt: openTask?.scheduledFor ?? reviewState.nextReviewAt
    });
  }

  return recommendations
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}

function rankCounts(values: string[]): RankedInsight[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 5);
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return groups;
}

function startOfWeek(date: Date): Date {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - daysFromMonday);
  return weekStart;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
