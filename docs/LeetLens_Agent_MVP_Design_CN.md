# LeetLens Agent MVP 设计文档

## 1. 文档目标

本文档定义 LeetLens Agent MVP 的产品入口、UI 形态、数据上下文、能力边界和后续接入 LLM / 云端服务的演进路线。

Agent MVP 的目标不是立刻做一个复杂聊天机器人，而是先让用户可以自然地询问自己的错题和复习计划：

```text
我这周错了什么？
明天该复习什么？
我最弱的 topic 是什么？
帮我生成一套 DP 复习计划。
```

## 2. MVP 原则

- Local-first：第一版优先使用浏览器本地 IndexedDB 数据
- Context-first：先基于 structured summary 回答，不直接让模型扫描所有 raw records
- Action-aware：回答里可以包含可执行 action，例如加入明天计划、创建新计划
- Low-risk：第一版可以先做 mock/local agent，不需要 API key
- Upgradeable：后续可以把 local response generator 替换成 LLM agent

## 2.1 长期 Agent 定位

LeetLens Agent 的长期定位不是简单的错题查询工具，而是一个 LeetCode mistake coach：

- 情感支持：当用户反复失败、刷题焦虑或进度慢时，先给出基于事实的鼓励，再给一个小的下一步行动。
- 学习计划：根据用户想加强的 topic、面试日期、近期错因和复习状态，生成可执行的 review plan draft。
- 面试方法：针对某个题型或单题，总结 1-2 个面试时最该讲清楚的方法、常见坑和表达顺序。
- 错题复盘：分析用户为什么重复犯同类错误，以及哪些题应该优先复习。

Agent 回答应尽量基于本地结构化数据，避免编造不存在的题目、计划或历史记录。

## 3. Agent 入口

### 3.1 Dashboard 全局入口

Dashboard 右下角或右上角放一个轻量入口：

```text
Ask LeetLens
```

点击后打开右侧抽屉：

```text
LeetLens Agent
Using your local mistake notebook
---------------------------------
Suggested questions
Conversation
Input
```

这是主要入口，因为用户在 Dashboard 看错题、计划和 weekly summary 时最容易产生问题。

### 3.2 Weekly Summary 快捷入口

Weekly Summary 区域可以提供 preset prompts：

```text
Ask:
[Explain weak topics]
[Plan tomorrow]
[Generate DP drill]
```

点击后打开 Agent Drawer，并自动填入或发送对应问题。

### 3.3 Problem Detail 局部入口

单题详情页后续可以提供：

```text
Ask about this problem
```

用于回答：

```text
为什么这题我错了多次？
我应该怎么复习这道题？
这个错因和哪些题相似？
```

## 4. Agent UI

### 4.1 Agent Drawer

MVP 推荐使用右侧抽屉，而不是独立页面。

```text
┌──────────────────────────────┐
│ LeetLens Agent               │
│ Local notebook context       │
├──────────────────────────────┤
│ Suggested prompts            │
│ [Tomorrow review]            │
│ [Weak topics]                │
│ [Generate drill]             │
├──────────────────────────────┤
│ User: What should I review?  │
│ Agent: ...                   │
│ Action card                  │
├──────────────────────────────┤
│ input                        │
└──────────────────────────────┘
```

### 4.2 Suggested Prompts

MVP prompts：

- What should I review tomorrow?
- What were my weakest topics this week?
- Which mistake reasons appear most often?
- Generate a review plan for Dynamic Programming.
- Which problems should I revisit before an interview?

### 4.3 Response Types

Agent 不只返回纯文本，还应该支持结构化响应。

```ts
type AgentResponse =
  | TextResponse
  | RecommendationResponse
  | PlanDraftResponse
  | ProblemExplanationResponse;
```

示例：

```text
You should review DP and edge cases first.

Recommended:
1. 322. Coin Change
2. 72. Edit Distance
3. 416. Partition Equal Subset Sum

[Add all to tomorrow]
[Create DP Sprint]
```

## 5. Agent 数据上下文

Agent MVP 应优先读取 structured data，而不是全部 raw records。

主要上下文：

- `ReviewInsightsSummary`
- `Problem`
- `SubmissionAttempt`
- `MistakeRecord`
- `ReviewState`
- `ReviewTask`
- `ReviewLog`

推荐上下文构造顺序：

```text
User question
↓
Load ReviewInsightsSummary
↓
Load relevant problem/task/mistake records if needed
↓
Generate local or LLM response
↓
Return response + optional actions
```

## 6. Agent Tools

MVP 工具接口可以先在本地实现：

```ts
getWeeklySummary()
getReviewRecommendations()
getProblemHistory(problemId)
getMistakePatterns()
createReviewPlan(name)
addProblemsToPlan(planId, problemIds, date)
```

未来接 LLM 时，这些可以变成 agent tools/function calling。

## 7. MVP 阶段划分

### Phase 1: Local Mock Agent

不接 API，只基于本地规则和 `ReviewInsightsSummary` 回答。

适合回答：

- 明天复习什么
- 本周弱项是什么
- 哪些错因最多
- 推荐哪几道题先复习

### Phase 2: LLM Agent

接入 OpenAI / Azure OpenAI / AWS Bedrock。

LLM 输入：

- 用户问题
- structured weekly summary
- relevant problem history
- available actions

LLM 输出：

- natural language answer
- structured action suggestions

推荐抽象模型 provider：

```ts
interface ModelProvider {
  complete(request: AgentRequest): Promise<AgentResponse>;
}
```

后续可以实现：

- `OpenAIProvider`
- `AnthropicDirectProvider`
- `BedrockClaudeProvider`

模型选择策略：

- `fast`：情感支持、欢迎语、轻量总结
- `balanced`：默认对话、错因总结、短期学习计划
- `deep_reasoning`：复杂面试策略、多周计划、跨 topic 复盘

第一版 LLM 建议默认使用 `auto + balanced`，开发者设置里再暴露 provider/model/mode。

### Phase 3: Cloud Agent

当有后端同步后，Agent 可以运行在云端：

```text
Chrome Extension
↓
Agent API
↓
PostgreSQL / Vector Store
↓
LLM Provider
```

Claude direct API 和 AWS Bedrock Claude 的取舍：

- Direct Claude API：适合 MVP 快速验证，接入简单，便于调 prompt 和模型能力。
- Bedrock Claude：适合 AWS-native / enterprise 部署，可使用 IAM、CloudWatch、Guardrails、Knowledge Bases、统一 AWS billing 和更强的企业数据治理。
- 代码上应通过 `ModelProvider` adapter 隔离差异，避免把业务逻辑写死在某个模型供应商上。

## 8. 非目标

Agent MVP 暂时不做：

- 自动读取用户全部 LeetCode 账号历史
- 自动提交代码
- 直接修改用户代码
- 云端同步
- 长期向量记忆
- 多用户权限系统

这些可以放到后续版本。

## 9. 后续待办

- 定义 LeetLens Agent 的 voice / tone guide，包括自我介绍、回答风格、鼓励程度、禁止编造数据等规则。
- 后续接入 LLM 时，将 voice / tone guide 转化为 system prompt，并补充 few-shot examples。
- 为 Agent 回答建立 evaluation cases，检查回答是否准确引用本地数据、是否给出可执行复习建议、是否保持稳定语气。

## 10. 面试表达

可以这样描述：

```text
Designed an agent-ready local context layer for a LeetCode mistake notebook. The agent MVP uses structured weekly insights, review states, mistake patterns, and scheduled tasks to answer personalized review questions and propose actionable study plans. The design supports a local mock agent first and can later be upgraded to an LLM-powered agent with tool calling and cloud sync.
```
