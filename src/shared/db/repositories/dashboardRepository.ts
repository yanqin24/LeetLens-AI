import { db } from "../schema";
import { startOfWeek } from "../../utils/date";

export type DashboardSummary = {
  dueTodayCount: number;
  newMistakesThisWeekCount: number;
  mostFrequentReason: string;
  weakestTag: string;
  totalMistakes: number;
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const now = new Date().toISOString();
  const weekStart = startOfWeek().toISOString();
  const [reviewStates, mistakes, problems] = await Promise.all([
    db.reviewStates.toArray(),
    db.mistakes.toArray(),
    db.problems.toArray()
  ]);

  const dueTodayCount = reviewStates.filter(
    (reviewState) => reviewState.status !== "mastered" && reviewState.nextReviewAt <= now
  ).length;
  const newMistakesThisWeekCount = mistakes.filter((mistake) => mistake.createdAt >= weekStart).length;
  const reasonCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const problemById = new Map(problems.map((problem) => [problem.id, problem]));

  for (const mistake of mistakes) {
    reasonCounts.set(mistake.primaryReason, (reasonCounts.get(mistake.primaryReason) ?? 0) + 1);

    const problem = problemById.get(mistake.problemId);
    for (const tag of problem?.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return {
    dueTodayCount,
    newMistakesThisWeekCount,
    mostFrequentReason: getHighestCountKey(reasonCounts),
    weakestTag: getHighestCountKey(tagCounts),
    totalMistakes: mistakes.length
  };
}

function getHighestCountKey(counts: Map<string, number>): string {
  let winner = "None";
  let highestCount = 0;

  for (const [key, count] of counts) {
    if (count > highestCount) {
      winner = key;
      highestCount = count;
    }
  }

  return winner;
}
