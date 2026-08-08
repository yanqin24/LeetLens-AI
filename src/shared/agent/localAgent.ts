import type { ReviewInsightsSummary } from "../insights/reviewInsights";

export type AgentPromptId =
  | "tomorrow_review"
  | "weak_topics"
  | "mistake_reasons"
  | "dp_drill"
  | "interview_review";

export type AgentMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
};

export type SuggestedAgentPrompt = {
  id: AgentPromptId;
  label: string;
  question: string;
};

export const suggestedAgentPrompts: SuggestedAgentPrompt[] = [
  {
    id: "tomorrow_review",
    label: "Tomorrow review",
    question: "What should I review tomorrow?"
  },
  {
    id: "weak_topics",
    label: "Weak topics",
    question: "What were my weakest topics this week?"
  },
  {
    id: "mistake_reasons",
    label: "Mistake reasons",
    question: "Which mistake reasons appear most often?"
  },
  {
    id: "dp_drill",
    label: "DP drill",
    question: "Generate a Dynamic Programming review drill."
  },
  {
    id: "interview_review",
    label: "Interview review",
    question: "Which problems should I revisit before an interview?"
  }
];

export function buildAgentWelcomeMessage(): string {
  return [
    "Hi, I can help turn your mistake notebook into a review plan.",
    "You can ask me:",
    "1. What should I review tomorrow?",
    "2. What were my weakest topics this week?",
    "3. Which mistake reasons appear most often?",
    "4. Which problems should I revisit before an interview?"
  ].join("\n");
}

export function answerLocalAgentQuestion(input: {
  question: string;
  summary: ReviewInsightsSummary;
}): string {
  const normalizedQuestion = normalizeQuestion(input.question);

  if (normalizedQuestion.includes("tomorrow")) {
    return buildTomorrowReviewAnswer(input.summary);
  }

  if (normalizedQuestion.includes("weak") || normalizedQuestion.includes("topic")) {
    return buildWeakTopicsAnswer(input.summary);
  }

  if (normalizedQuestion.includes("reason") || normalizedQuestion.includes("mistake")) {
    return buildMistakeReasonsAnswer(input.summary);
  }

  if (normalizedQuestion.includes("dp") || normalizedQuestion.includes("dynamic programming")) {
    return buildDrillAnswer(input.summary, "Dynamic Programming");
  }

  if (normalizedQuestion.includes("interview")) {
    return buildInterviewReviewAnswer(input.summary);
  }

  return buildGeneralAnswer(input.summary);
}

function normalizeQuestion(question: string): string {
  const normalizedQuestion = question.trim().toLowerCase();

  if (normalizedQuestion === "1") {
    return "tomorrow review";
  }

  if (normalizedQuestion === "2") {
    return "weak topics";
  }

  if (normalizedQuestion === "3") {
    return "mistake reasons";
  }

  if (normalizedQuestion === "4") {
    return "interview review";
  }

  return normalizedQuestion;
}

function buildTomorrowReviewAnswer(summary: ReviewInsightsSummary): string {
  const recommendations = formatRecommendations(summary);

  return [
    `You have ${summary.dueTomorrowCount} task${summary.dueTomorrowCount === 1 ? "" : "s"} due tomorrow.`,
    recommendations
      ? `Start with these high-priority reviews:\n${recommendations}`
      : "No specific recommendations yet. Add a few weak problems to tomorrow's plan if you want a focused session."
  ].join("\n\n");
}

function buildWeakTopicsAnswer(summary: ReviewInsightsSummary): string {
  if (!summary.weakestTopics.length) {
    return "I do not have enough topic data yet. Capture a few more failed submissions and I can identify weak areas.";
  }

  return [
    "Your weakest topics are:",
    formatRankedRows(summary.weakestTopics),
    "Focus your next review session on the top one or two topics first."
  ].join("\n\n");
}

function buildMistakeReasonsAnswer(summary: ReviewInsightsSummary): string {
  if (!summary.topMistakeReasons.length) {
    return "I do not have enough mistake reason data yet. Save reasons for a few mistakes and I can summarize the pattern.";
  }

  return [
    "Your most common mistake reasons are:",
    formatRankedRows(summary.topMistakeReasons),
    "A good next step is to review one problem for each top reason and write down the recurring fix."
  ].join("\n\n");
}

function buildDrillAnswer(summary: ReviewInsightsSummary, topic: string): string {
  const matchingRecommendations = summary.recommendedReviews.filter((item) =>
    item.topic.toLowerCase().includes(topic.toLowerCase())
  );
  const recommendations = formatRecommendations({
    ...summary,
    recommendedReviews: matchingRecommendations.length ? matchingRecommendations : summary.recommendedReviews
  });

  return [
    `${topic} drill suggestion:`,
    recommendations || "I do not have enough DP-specific recommendations yet. Use your highest-priority reviews first.",
    "Keep the drill short: 3 problems, then write one sentence about the mistake pattern."
  ].join("\n\n");
}

function buildInterviewReviewAnswer(summary: ReviewInsightsSummary): string {
  const recommendations = formatRecommendations(summary);

  return [
    "For interview prep, prioritize problems with low mastery, repeated mistakes, or upcoming review dates.",
    recommendations || "No recommended problems yet.",
    `This week: ${summary.weeklyFailedAttemptCount}/${summary.weeklyAttemptCount} attempts failed, and ${summary.failedAgainCount} reviews failed again.`
  ].join("\n\n");
}

function buildGeneralAnswer(summary: ReviewInsightsSummary): string {
  return [
    "Here is the current review snapshot:",
    `- Attempts this week: ${summary.weeklyAttemptCount}`,
    `- Failed attempts this week: ${summary.weeklyFailedAttemptCount}`,
    `- Due today: ${summary.dueTodayCount}`,
    `- Due tomorrow: ${summary.dueTomorrowCount}`,
    "Try asking about tomorrow's review, weak topics, mistake reasons, or interview prep."
  ].join("\n");
}

function formatRecommendations(summary: ReviewInsightsSummary): string {
  return summary.recommendedReviews
    .slice(0, 5)
    .map((item, index) => `${index + 1}. ${item.leetcodeId ? `${item.leetcodeId}. ` : ""}${item.title} - ${item.topic}, ${item.reason}`)
    .join("\n");
}

function formatRankedRows(rows: Array<{ label: string; count: number }>): string {
  return rows.map((row, index) => `${index + 1}. ${row.label} (${row.count})`).join("\n");
}
