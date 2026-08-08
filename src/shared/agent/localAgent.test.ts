import { describe, expect, it } from "vitest";
import type { ReviewInsightsSummary } from "../insights/reviewInsights";
import { answerLocalAgentQuestion, buildAgentWelcomeMessage } from "./localAgent";

describe("answerLocalAgentQuestion", () => {
  it("answers tomorrow review questions with due count and recommendations", () => {
    const answer = answerLocalAgentQuestion({
      question: "What should I review tomorrow?",
      summary: createSummary()
    });

    expect(answer).toContain("2 tasks due tomorrow");
    expect(answer).toContain("1. 70. Climbing Stairs");
    expect(answer).toContain("Dynamic Programming");
  });

  it("answers weak topic questions with ranked topics", () => {
    const answer = answerLocalAgentQuestion({
      question: "What are my weak topics?",
      summary: createSummary()
    });

    expect(answer).toContain("Your weakest topics are:");
    expect(answer).toContain("1. Dynamic Programming (3)");
    expect(answer).toContain("2. Array (2)");
  });

  it("answers mistake reason questions with ranked reasons", () => {
    const answer = answerLocalAgentQuestion({
      question: "Which mistake reasons happen most often?",
      summary: createSummary()
    });

    expect(answer).toContain("Your most common mistake reasons are:");
    expect(answer).toContain("Implementation Detail Error");
    expect(answer).toContain("Wrong Recurrence");
  });

  it("prioritizes topic-specific recommendations for DP drills", () => {
    const answer = answerLocalAgentQuestion({
      question: "Generate a DP drill",
      summary: createSummary({
        recommendedReviews: [
          {
            problemId: "problem_array",
            leetcodeId: "1",
            title: "Two Sum",
            topic: "Array",
            reason: "Boundary Condition",
            priority: 99
          },
          {
            problemId: "problem_dp",
            leetcodeId: "70",
            title: "Climbing Stairs",
            topic: "Dynamic Programming",
            reason: "Wrong Recurrence",
            priority: 80
          }
        ]
      })
    });

    expect(answer).toContain("Dynamic Programming drill suggestion:");
    expect(answer).toContain("1. 70. Climbing Stairs");
    expect(answer).not.toContain("Two Sum");
  });

  it("maps numbered shortcuts to suggested questions", () => {
    expect(
      answerLocalAgentQuestion({
        question: "1",
        summary: createSummary()
      })
    ).toContain("tasks due tomorrow");

    expect(
      answerLocalAgentQuestion({
        question: "2",
        summary: createSummary()
      })
    ).toContain("Your weakest topics are:");

    expect(
      answerLocalAgentQuestion({
        question: "3",
        summary: createSummary()
      })
    ).toContain("Your most common mistake reasons are:");

    expect(
      answerLocalAgentQuestion({
        question: "4",
        summary: createSummary()
      })
    ).toContain("For interview prep");
  });

  it("builds a conversational welcome message with numbered guidance", () => {
    const message = buildAgentWelcomeMessage();

    expect(message).toContain("Hi, I can help");
    expect(message).toContain("1. What should I review tomorrow?");
    expect(message).toContain("4. Which problems should I revisit before an interview?");
  });
});

function createSummary(overrides: Partial<ReviewInsightsSummary> = {}): ReviewInsightsSummary {
  return {
    weeklyAttemptCount: 8,
    weeklyFailedAttemptCount: 5,
    weeklyReviewedCount: 3,
    failedAgainCount: 1,
    dueTodayCount: 1,
    dueTomorrowCount: 2,
    dueThisWeekCount: 4,
    topMistakeReasons: [
      { label: "Implementation Detail Error", count: 4 },
      { label: "Wrong Recurrence", count: 2 }
    ],
    weakestTopics: [
      { label: "Dynamic Programming", count: 3 },
      { label: "Array", count: 2 }
    ],
    recommendedReviews: [
      {
        problemId: "problem_dp",
        leetcodeId: "70",
        title: "Climbing Stairs",
        topic: "Dynamic Programming",
        reason: "Wrong Recurrence",
        priority: 90
      }
    ],
    ...overrides
  };
}
