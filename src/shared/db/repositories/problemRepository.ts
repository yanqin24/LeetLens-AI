import { db } from "../schema";
import type { Problem, ProblemInput } from "../../types/problem";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/date";

export async function upsertProblem(input: ProblemInput): Promise<Problem> {
  const existing = await db.problems.where("slug").equals(input.slug).first();
  const now = nowIso();

  if (existing) {
    const updated: Problem = {
      ...existing,
      leetcodeId: input.leetcodeId ?? existing.leetcodeId,
      title: input.title || existing.title,
      url: input.url || existing.url,
      difficulty: input.difficulty ?? existing.difficulty,
      tags: input.tags?.length ? input.tags : existing.tags,
      lastSeenAt: now
    };

    await db.problems.put(updated);
    return updated;
  }

  const problem: Problem = {
    id: createId("problem"),
    leetcodeId: input.leetcodeId,
    title: input.title,
    slug: input.slug,
    url: input.url,
    difficulty: input.difficulty ?? "Unknown",
    tags: input.tags ?? [],
    firstSeenAt: now,
    lastSeenAt: now
  };

  await db.problems.add(problem);
  return problem;
}

export async function getProblemById(problemId: string): Promise<Problem | undefined> {
  return db.problems.get(problemId);
}

export async function listProblems(): Promise<Problem[]> {
  return db.problems.orderBy("lastSeenAt").reverse().toArray();
}
