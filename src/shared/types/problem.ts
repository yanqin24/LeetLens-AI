export type Difficulty = "Easy" | "Medium" | "Hard" | "Unknown";

export type Problem = {
  id: string;
  leetcodeId?: string;
  title: string;
  slug: string;
  url: string;
  difficulty: Difficulty;
  tags: string[];
  firstSeenAt: string;
  lastSeenAt: string;
};

export type ProblemInput = {
  leetcodeId?: string;
  title: string;
  slug: string;
  url: string;
  difficulty?: Difficulty;
  tags?: string[];
};
