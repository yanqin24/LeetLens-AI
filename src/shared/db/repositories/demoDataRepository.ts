import { db } from "../schema";
import type { SubmissionAttempt, SubmissionResult } from "../../types/attempt";
import type { MistakeRecord } from "../../types/mistake";
import type { Difficulty, Problem } from "../../types/problem";
import type { ReviewPlan, ReviewTask, ReviewTaskStatus } from "../../types/reviewPlan";
import type { ReviewState } from "../../types/review";
import { addDaysIso, nowIso } from "../../utils/date";
import { createId } from "../../utils/ids";

type DemoProblem = {
  leetcodeId: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  tags: string[];
  result: SubmissionResult;
  language: string;
  code: string;
  errorMessage: string;
  primaryReason: string;
  secondaryReason: string;
  note: string;
  mastery: ReviewState["mastery"];
  nextReviewDayOffset: number;
  status?: ReviewState["status"];
  repeatDaily?: boolean;
};

type DemoDataIds = {
  attemptIds: string[];
  mistakeIds: string[];
  planIds: string[];
  problemIds: string[];
  reviewLogIds: string[];
  reviewStateIds: string[];
  taskIds: string[];
};

export type RemoveDemoDataResult = {
  attempts: number;
  mistakes: number;
  plans: number;
  problems: number;
  reviewLogs: number;
  reviewStates: number;
  tasks: number;
};

const demoProblems: DemoProblem[] = [
  {
    leetcodeId: "1",
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "Easy",
    tags: ["Array", "Hash Table"],
    result: "Wrong Answer",
    language: "Python3",
    code: "class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, n in enumerate(nums):\n            seen[n] = i\n            if target - n in seen:\n                return [seen[target - n], i]\n        return []",
    errorMessage: "Wrong Answer\nInput: nums = [3,3], target = 6\nOutput: [1,1]\nExpected: [0,1]",
    primaryReason: "Implementation Detail Error",
    secondaryReason: "Wrong update order",
    note: "Check complement before inserting current index.",
    mastery: 2,
    nextReviewDayOffset: 0
  },
  {
    leetcodeId: "704",
    title: "Binary Search",
    slug: "binary-search",
    difficulty: "Easy",
    tags: ["Array", "Binary Search"],
    result: "Wrong Answer",
    language: "Python3",
    code: "class Solution:\n    def search(self, nums, target):\n        left, right = 0, len(nums) - 1\n        while left < right:\n            mid = (left + right) // 2\n            if nums[mid] == target:\n                return mid\n            if nums[mid] < target:\n                left = mid + 1\n            else:\n                right = mid - 1\n        return -1",
    errorMessage: "Wrong Answer\nInput: nums = [5], target = 5\nOutput: -1\nExpected: 0",
    primaryReason: "Missing Edge Case",
    secondaryReason: "Single element",
    note: "Use left <= right for closed interval binary search.",
    mastery: 1,
    nextReviewDayOffset: 0
  },
  {
    leetcodeId: "3",
    title: "Longest Substring Without Repeating Characters",
    slug: "longest-substring-without-repeating-characters",
    difficulty: "Medium",
    tags: ["Hash Table", "String", "Sliding Window"],
    result: "Wrong Answer",
    language: "TypeScript",
    code: "function lengthOfLongestSubstring(s: string): number {\n  const seen = new Set<string>();\n  let left = 0;\n  let best = 0;\n  for (let right = 0; right < s.length; right++) {\n    if (seen.has(s[right])) left++;\n    seen.add(s[right]);\n    best = Math.max(best, right - left + 1);\n  }\n  return best;\n}",
    errorMessage: "Wrong Answer\nInput: s = \"abba\"\nOutput: 3\nExpected: 2",
    primaryReason: "Algorithmic Approach Error",
    secondaryReason: "Incorrect state definition",
    note: "Shrink window until duplicate is removed, not just one step.",
    mastery: 2,
    nextReviewDayOffset: 1
  },
  {
    leetcodeId: "322",
    title: "Coin Change",
    slug: "coin-change",
    difficulty: "Medium",
    tags: ["Array", "Dynamic Programming", "Breadth-First Search"],
    result: "Wrong Answer",
    language: "Java",
    code: "class Solution {\n  public int coinChange(int[] coins, int amount) {\n    int[] dp = new int[amount + 1];\n    for (int coin : coins) {\n      for (int a = coin; a <= amount; a++) {\n        dp[a] = Math.min(dp[a], dp[a - coin] + 1);\n      }\n    }\n    return dp[amount];\n  }\n}",
    errorMessage: "Wrong Answer\nInput: coins = [2], amount = 3\nOutput: 0\nExpected: -1",
    primaryReason: "Algorithmic Approach Error",
    secondaryReason: "Incorrect initialization",
    note: "Initialize dp with amount + 1 sentinel, dp[0] = 0.",
    mastery: 1,
    nextReviewDayOffset: 1,
    repeatDaily: true
  },
  {
    leetcodeId: "200",
    title: "Number of Islands",
    slug: "number-of-islands",
    difficulty: "Medium",
    tags: ["Array", "Depth-First Search", "Breadth-First Search", "Matrix"],
    result: "Runtime Error",
    language: "Python3",
    code: "class Solution:\n    def numIslands(self, grid):\n        def dfs(r, c):\n            if grid[r][c] != '1':\n                return\n            grid[r][c] = '0'\n            for dr, dc in [(1,0),(-1,0),(0,1),(0,-1)]:\n                dfs(r + dr, c + dc)\n        count = 0\n        for r in range(len(grid)):\n            for c in range(len(grid[0])):\n                if grid[r][c] == '1':\n                    count += 1\n                    dfs(r, c)\n        return count",
    errorMessage: "Runtime Error\nIndexError: list index out of range",
    primaryReason: "Missing Edge Case",
    secondaryReason: "Out-of-bounds",
    note: "DFS needs boundary checks before reading grid[r][c].",
    mastery: 2,
    nextReviewDayOffset: 0
  },
  {
    leetcodeId: "102",
    title: "Binary Tree Level Order Traversal",
    slug: "binary-tree-level-order-traversal",
    difficulty: "Medium",
    tags: ["Tree", "Breadth-First Search", "Binary Tree"],
    result: "Wrong Answer",
    language: "Python3",
    code: "class Solution:\n    def levelOrder(self, root):\n        q = [root]\n        ans = []\n        while q:\n            level = []\n            for node in q:\n                level.append(node.val)\n                if node.left: q.append(node.left)\n                if node.right: q.append(node.right)\n            ans.append(level)\n        return ans",
    errorMessage: "Time Limit Exceeded\nQueue keeps growing while iterating over the same list.",
    primaryReason: "Implementation Detail Error",
    secondaryReason: "Wrong update order",
    note: "Use fixed level size or a separate next queue.",
    mastery: 3,
    nextReviewDayOffset: 2
  },
  {
    leetcodeId: "215",
    title: "Kth Largest Element in an Array",
    slug: "kth-largest-element-in-an-array",
    difficulty: "Medium",
    tags: ["Array", "Divide and Conquer", "Heap", "Quickselect"],
    result: "Wrong Answer",
    language: "Python3",
    code: "class Solution:\n    def findKthLargest(self, nums, k):\n        nums.sort()\n        return nums[k]",
    errorMessage: "Wrong Answer\nInput: nums = [3,2,1,5,6,4], k = 2\nOutput: 2\nExpected: 5",
    primaryReason: "Problem Understanding Error",
    secondaryReason: "Misunderstood target condition",
    note: "Kth largest after ascending sort is nums[-k].",
    mastery: 2,
    nextReviewDayOffset: 2
  },
  {
    leetcodeId: "46",
    title: "Permutations",
    slug: "permutations",
    difficulty: "Medium",
    tags: ["Array", "Backtracking"],
    result: "Wrong Answer",
    language: "JavaScript",
    code: "var permute = function(nums) {\n  const ans = [];\n  const path = [];\n  function dfs() {\n    if (path.length === nums.length) ans.push(path);\n    for (const n of nums) {\n      path.push(n);\n      dfs();\n      path.pop();\n    }\n  }\n  dfs();\n  return ans;\n};",
    errorMessage: "Wrong Answer\nDuplicate values in each permutation and repeated references in output.",
    primaryReason: "Implementation Detail Error",
    secondaryReason: "Incorrect initialization",
    note: "Track used indices and push a copy of path.",
    mastery: 1,
    nextReviewDayOffset: 1
  },
  {
    leetcodeId: "739",
    title: "Daily Temperatures",
    slug: "daily-temperatures",
    difficulty: "Medium",
    tags: ["Array", "Stack", "Monotonic Stack"],
    result: "Wrong Answer",
    language: "Python3",
    code: "class Solution:\n    def dailyTemperatures(self, temperatures):\n        ans = [0] * len(temperatures)\n        stack = []\n        for i, t in enumerate(temperatures):\n            while stack and temperatures[stack[-1]] < t:\n                prev = stack.pop()\n                ans[prev] = i\n            stack.append(i)\n        return ans",
    errorMessage: "Wrong Answer\nOutput stores next warmer index instead of days waited.",
    primaryReason: "Implementation Detail Error",
    secondaryReason: "Return value error",
    note: "Store i - prev, not i.",
    mastery: 2,
    nextReviewDayOffset: 3
  },
  {
    leetcodeId: "21",
    title: "Merge Two Sorted Lists",
    slug: "merge-two-sorted-lists",
    difficulty: "Easy",
    tags: ["Linked List", "Recursion"],
    result: "Compile Error",
    language: "Java",
    code: "class Solution {\n  public ListNode mergeTwoLists(ListNode list1, ListNode list2) {\n    ListNode dummy = new ListNode();\n    cur = dummy;\n    return dummy.next;\n  }\n}",
    errorMessage: "Compile Error\ncannot find symbol: variable cur",
    primaryReason: "Syntax / API Error",
    secondaryReason: "Variable name error",
    note: "Declare ListNode cur = dummy before using it.",
    mastery: 3,
    nextReviewDayOffset: 0
  },
  {
    leetcodeId: "55",
    title: "Jump Game",
    slug: "jump-game",
    difficulty: "Medium",
    tags: ["Array", "Dynamic Programming", "Greedy"],
    result: "Wrong Answer",
    language: "Python3",
    code: "class Solution:\n    def canJump(self, nums):\n        reach = 0\n        for i, jump in enumerate(nums):\n            reach = max(reach, i + jump)\n        return reach >= len(nums) - 1",
    errorMessage: "Wrong Answer\nInput: nums = [3,2,1,0,4]\nOutput: true\nExpected: false",
    primaryReason: "Algorithmic Approach Error",
    secondaryReason: "Incorrect greedy condition",
    note: "If i > reach, current index is unreachable.",
    mastery: 2,
    nextReviewDayOffset: 3
  },
  {
    leetcodeId: "72",
    title: "Edit Distance",
    slug: "edit-distance",
    difficulty: "Hard",
    tags: ["String", "Dynamic Programming"],
    result: "Wrong Answer",
    language: "Python3",
    code: "class Solution:\n    def minDistance(self, word1, word2):\n        m, n = len(word1), len(word2)\n        dp = [[0] * n for _ in range(m)]\n        for i in range(m):\n            for j in range(n):\n                if word1[i] == word2[j]:\n                    dp[i][j] = dp[i-1][j-1]\n                else:\n                    dp[i][j] = 1 + min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])\n        return dp[-1][-1]",
    errorMessage: "Wrong Answer\nInput: word1 = \"\", word2 = \"a\"\nExpected: 1",
    primaryReason: "Missing Edge Case",
    secondaryReason: "Empty input",
    note: "DP table needs (m + 1) x (n + 1) base row and column.",
    mastery: 1,
    nextReviewDayOffset: 2
  }
];

export async function seedDemoData(): Promise<void> {
  const now = nowIso();
  const problems: Problem[] = [];
  const attempts: SubmissionAttempt[] = [];
  const mistakes: MistakeRecord[] = [];
  const reviewStates: ReviewState[] = [];
  const reviewPlans: ReviewPlan[] = [
    createDemoPlan("demo_plan_default", "Default Review Plan", "default", "Auto-scheduled from your due mistakes.", now),
    createDemoPlan("demo_plan_dp", "DP Weak Spots", "custom", "Dynamic programming mistakes for focused interview prep.", now),
    createDemoPlan("demo_plan_binary", "Binary Search Sprint", "custom", "Boundary-heavy binary search practice.", now),
    createDemoPlan("demo_plan_edge", "Edge Case Cleanup", "custom", "Problems grouped by missed edge cases.", now)
  ];
  const reviewTasks: ReviewTask[] = [];

  demoProblems.forEach((demoProblem, index) => {
    const problemId = createId("demo_problem");
    const attemptId = createId("demo_attempt");
    const mistakeId = createId("demo_mistake");
    const reviewId = createId("demo_review");
    const submittedAt = addDaysIso(now, -Math.max(1, index % 8));
    const nextReviewAt = addDaysIso(now, demoProblem.nextReviewDayOffset);

    problems.push({
      id: problemId,
      leetcodeId: demoProblem.leetcodeId,
      title: demoProblem.title,
      slug: demoProblem.slug,
      url: `https://leetcode.com/problems/${demoProblem.slug}/`,
      difficulty: demoProblem.difficulty,
      tags: demoProblem.tags,
      firstSeenAt: submittedAt,
      lastSeenAt: submittedAt
    });

    attempts.push({
      id: attemptId,
      problemId,
      submittedAt,
      language: demoProblem.language,
      code: demoProblem.code,
      result: demoProblem.result,
      errorMessage: demoProblem.errorMessage,
      codeCaptureStatus: "success",
      fingerprint: `demo-${demoProblem.slug}`
    });

    mistakes.push({
      id: mistakeId,
      problemId,
      attemptId,
      primaryReason: demoProblem.primaryReason,
      secondaryReason: demoProblem.secondaryReason,
      note: demoProblem.note,
      confidence: "user_confirmed",
      createdAt: submittedAt,
      updatedAt: submittedAt
    });

    reviewStates.push({
      id: reviewId,
      problemId,
      status: demoProblem.status ?? "scheduled",
      mastery: demoProblem.mastery,
      scheduleMode: demoProblem.repeatDaily ? "manual" : "auto",
      nextReviewAt,
      reviewCount: index % 3,
      positiveStreak: demoProblem.mastery >= 3 ? 1 : 0,
      manualReviewAt: demoProblem.repeatDaily ? nextReviewAt : undefined,
      manualReason: demoProblem.repeatDaily ? "daily_drill" : undefined,
      repeatType: demoProblem.repeatDaily ? "daily" : undefined,
      repeatStartAt: demoProblem.repeatDaily ? now : undefined,
      repeatUntil: demoProblem.repeatDaily ? addDaysIso(now, 6) : undefined,
      createdAt: submittedAt,
      updatedAt: now
    });
  });

  const problemBySlug = new Map(problems.map((problem) => [problem.slug, problem]));
  const attemptsByProblemId = new Map(attempts.map((attempt) => [attempt.problemId, attempt]));

  addDemoTasks(reviewTasks, "demo_plan_default", now, problemBySlug, attemptsByProblemId, [
    ["binary-search", 0, "todo"],
    ["number-of-islands", 0, "todo"],
    ["merge-two-sorted-lists", 0, "done"],
    ["coin-change", 1, "todo"],
    ["permutations", 1, "todo"],
    ["edit-distance", 2, "todo"],
    ["daily-temperatures", 3, "todo"]
  ]);

  addDemoTasks(reviewTasks, "demo_plan_dp", now, problemBySlug, attemptsByProblemId, [
    ["coin-change", 0, "todo"],
    ["edit-distance", 0, "todo"],
    ["jump-game", 1, "in_progress"],
    ["coin-change", 2, "todo"],
    ["edit-distance", 3, "todo"]
  ]);

  addDemoTasks(reviewTasks, "demo_plan_binary", now, problemBySlug, attemptsByProblemId, [
    ["binary-search", 0, "todo"],
    ["two-sum", 1, "skipped"],
    ["kth-largest-element-in-an-array", 2, "todo"]
  ]);

  addDemoTasks(reviewTasks, "demo_plan_edge", now, problemBySlug, attemptsByProblemId, [
    ["binary-search", 0, "todo"],
    ["number-of-islands", 0, "failed_today"],
    ["edit-distance", 1, "todo"],
    ["daily-temperatures", 2, "todo"],
    ["two-sum", 3, "todo"]
  ]);

  await db.transaction(
    "rw",
    [
      db.problems,
      db.attempts,
      db.mistakes,
      db.reviewStates,
      db.reviewLogs,
      db.reviewPlans,
      db.reviewTasks
    ],
    async () => {
      await deleteDemoDataIds(await collectDemoDataIds());

      await db.problems.bulkPut(problems);
      await db.attempts.bulkPut(attempts);
      await db.mistakes.bulkPut(mistakes);
      await db.reviewStates.bulkPut(reviewStates);
      await db.reviewPlans.bulkPut(reviewPlans);
      await db.reviewTasks.bulkPut(reviewTasks);
    }
  );
}

export async function removeDemoData(): Promise<RemoveDemoDataResult> {
  return db.transaction(
    "rw",
    [
      db.problems,
      db.attempts,
      db.mistakes,
      db.reviewStates,
      db.reviewLogs,
      db.reviewPlans,
      db.reviewTasks
    ],
    async () => {
      const ids = await collectDemoDataIds();
      await deleteDemoDataIds(ids);

      return {
        attempts: ids.attemptIds.length,
        mistakes: ids.mistakeIds.length,
        plans: ids.planIds.length,
        problems: ids.problemIds.length,
        reviewLogs: ids.reviewLogIds.length,
        reviewStates: ids.reviewStateIds.length,
        tasks: ids.taskIds.length
      };
    }
  );
}

export async function hasDemoData(): Promise<boolean> {
  const demoAttempt = await db.attempts
    .filter((attempt) => attempt.fingerprint.startsWith("demo-"))
    .first();

  if (demoAttempt) {
    return true;
  }

  const demoPlan = await db.reviewPlans
    .filter((plan) => plan.id.startsWith("demo_plan_"))
    .first();

  return Boolean(demoPlan);
}

async function collectDemoDataIds(): Promise<DemoDataIds> {
  const existingDemoAttempts = await db.attempts
    .filter((attempt) => attempt.fingerprint.startsWith("demo-"))
    .toArray();
  const existingDemoProblemIds = Array.from(
    new Set(existingDemoAttempts.map((attempt) => attempt.problemId))
  );
  const existingDemoAttemptIds = existingDemoAttempts.map((attempt) => attempt.id);
  const existingDemoMistakes = await db.mistakes
    .filter(
      (mistake) =>
        existingDemoProblemIds.includes(mistake.problemId) ||
        existingDemoAttemptIds.includes(mistake.attemptId)
    )
    .toArray();
  const existingDemoReviewStates = await db.reviewStates
    .filter((reviewState) => existingDemoProblemIds.includes(reviewState.problemId))
    .toArray();
  const existingDemoReviewLogs = await db.reviewLogs
    .filter((reviewLog) => existingDemoProblemIds.includes(reviewLog.problemId))
    .toArray();
  const existingDemoPlans = await db.reviewPlans
    .filter((plan) => plan.id.startsWith("demo_plan_"))
    .toArray();
  const existingDemoPlanIds = existingDemoPlans.map((plan) => plan.id);
  const existingDemoTasks = await db.reviewTasks
    .filter(
      (task) =>
        task.id.startsWith("demo_task_") ||
        existingDemoPlanIds.includes(task.planId) ||
        existingDemoProblemIds.includes(task.problemId)
    )
    .toArray();

  return {
    attemptIds: existingDemoAttemptIds,
    mistakeIds: existingDemoMistakes.map((mistake) => mistake.id),
    planIds: existingDemoPlanIds,
    problemIds: existingDemoProblemIds,
    reviewLogIds: existingDemoReviewLogs.map((reviewLog) => reviewLog.id),
    reviewStateIds: existingDemoReviewStates.map((reviewState) => reviewState.id),
    taskIds: existingDemoTasks.map((task) => task.id)
  };
}

async function deleteDemoDataIds(ids: DemoDataIds): Promise<void> {
  await Promise.all([
    db.mistakes.bulkDelete(ids.mistakeIds),
    db.reviewStates.bulkDelete(ids.reviewStateIds),
    db.reviewLogs.bulkDelete(ids.reviewLogIds),
    db.reviewTasks.bulkDelete(ids.taskIds),
    db.reviewPlans.bulkDelete(ids.planIds),
    db.attempts.bulkDelete(ids.attemptIds),
    db.problems.bulkDelete(ids.problemIds)
  ]);
}

function createDemoPlan(
  id: string,
  name: string,
  type: ReviewPlan["type"],
  description: string,
  now: string
): ReviewPlan {
  return {
    id,
    name,
    type,
    description,
    active: true,
    createdAt: now,
    updatedAt: now
  };
}

function addDemoTasks(
  tasks: ReviewTask[],
  planId: string,
  now: string,
  problemBySlug: Map<string, Problem>,
  attemptsByProblemId: Map<string, SubmissionAttempt>,
  specs: Array<[slug: string, dayOffset: number, status: ReviewTaskStatus]>
): void {
  specs.forEach(([slug, dayOffset, status], index) => {
    const problem = problemBySlug.get(slug);

    if (!problem) {
      return;
    }

    const scheduledFor = addDaysIso(now, dayOffset);
    const latestAttempt = attemptsByProblemId.get(problem.id);

    tasks.push({
      id: `demo_task_${planId}_${slug}_${dayOffset}_${index}`,
      planId,
      problemId: problem.id,
      scheduledFor,
      status,
      source: planId === "demo_plan_default" ? "auto" : "filter",
      latestAttemptId: latestAttempt?.id,
      openedAt: status !== "todo" ? addDaysIso(scheduledFor, 0) : undefined,
      completedAt: status === "done" ? addDaysIso(scheduledFor, 0) : undefined,
      createdAt: now,
      updatedAt: now
    });
  });
}
