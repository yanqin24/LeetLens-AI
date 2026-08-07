import { db } from "../schema";
import type { Difficulty, Problem } from "../../types/problem";

type LeetCodeQuestion = {
  questionFrontendId?: string;
  title?: string;
  difficulty?: Difficulty;
  topicTags?: Array<{ name?: string }>;
};

type LeetCodeQuestionResponse = {
  data?: {
    question?: LeetCodeQuestion;
  };
};

export type RepairProblemMetadataResult = {
  scanned: number;
  repaired: number;
  failed: number;
  skipped: number;
};

const QUESTION_DATA_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionFrontendId
      title
      difficulty
      topicTags {
        name
      }
    }
  }
`;

export function needsProblemMetadataRepair(problem: Problem): boolean {
  return (
    !problem.leetcodeId ||
    isSlugLikeTitle(problem.title, problem.slug) ||
    problem.difficulty === "Unknown" ||
    problem.tags.length === 0
  );
}

export async function repairProblemMetadata(): Promise<RepairProblemMetadataResult> {
  const problems = await db.problems.toArray();
  const repairCandidates = problems.filter(needsProblemMetadataRepair);
  const result: RepairProblemMetadataResult = {
    scanned: problems.length,
    repaired: 0,
    failed: 0,
    skipped: problems.length - repairCandidates.length
  };

  for (const problem of repairCandidates) {
    try {
      const metadata = await fetchLeetCodeQuestion(problem.slug);

      if (!metadata) {
        result.failed += 1;
        continue;
      }

      await db.problems.put({
        ...problem,
        leetcodeId: metadata.questionFrontendId || problem.leetcodeId,
        title: metadata.title || problem.title,
        difficulty: metadata.difficulty ?? problem.difficulty,
        tags: metadata.topicTags?.map((tag) => tag.name).filter((tag): tag is string => Boolean(tag)) ?? problem.tags,
        lastSeenAt: new Date().toISOString()
      });
      result.repaired += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}

async function fetchLeetCodeQuestion(slug: string): Promise<LeetCodeQuestion | undefined> {
  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      operationName: "questionData",
      query: QUESTION_DATA_QUERY,
      variables: {
        titleSlug: slug
      }
    })
  });

  if (!response.ok) {
    throw new Error(`LeetCode metadata request failed: ${response.status}`);
  }

  const payload = (await response.json()) as LeetCodeQuestionResponse;
  return payload.data?.question;
}

function isSlugLikeTitle(title: string, slug: string): boolean {
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedSlug = slug.trim().toLowerCase();
  const slugAsTitle = normalizedSlug
    .split("-")
    .filter(Boolean)
    .join(" ");

  return normalizedTitle === normalizedSlug || normalizedTitle === slugAsTitle;
}
