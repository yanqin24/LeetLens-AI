# LeetLens Agent MVP Design

## 1. Document Goal

This document defines the product entry points, UI model, data context, capability boundaries, and future LLM/cloud evolution path for the LeetLens Agent MVP.

The MVP goal is not to build a complex chatbot immediately. The goal is to let users naturally ask questions about their mistake notebook and review plan:

```text
What did I miss this week?
What should I review tomorrow?
What are my weakest topics?
Generate a DP review plan for me.
```

## 2. MVP Principles

- Local-first: use IndexedDB data in the browser first
- Context-first: answer from structured summaries instead of scanning all raw records
- Action-aware: responses can include actions such as adding problems to tomorrow or creating a plan
- Low-risk: the first version can be a local/mock agent with no API key
- Upgradeable: the local response generator can later be replaced by an LLM agent

## 2.1 Long-Term Agent Positioning

LeetLens Agent should evolve beyond a mistake lookup bot into a LeetCode mistake coach:

- Emotional support: when users feel stuck, frustrated, or behind, acknowledge the situation, encourage them with grounded evidence, and suggest one small next action.
- Study planning: generate review plan drafts from the user's target topic, interview timeline, recent mistake reasons, and review state.
- Interview strategy: for a topic or specific problem, summarize 1-2 interview-ready methods, common pitfalls, and explanation order.
- Mistake reflection: explain repeated mistake patterns and identify which problems deserve priority review.

Agent responses should stay grounded in local structured data and avoid inventing problems, plans, or history.

## 3. Agent Entry Points

### 3.1 Global Dashboard Entry

Add a lightweight global entry on the Dashboard:

```text
Ask LeetLens
```

Clicking it opens a right-side drawer:

```text
LeetLens Agent
Using your local mistake notebook
---------------------------------
Suggested questions
Conversation
Input
```

This is the primary entry because users are most likely to ask questions while viewing the Dashboard, review plans, and weekly summary.

### 3.2 Weekly Summary Shortcuts

The Weekly Summary section can include preset prompts:

```text
Ask:
[Explain weak topics]
[Plan tomorrow]
[Generate DP drill]
```

Clicking a shortcut opens the Agent Drawer and fills or sends the prompt.

### 3.3 Problem Detail Entry

The Problem Detail page can later include:

```text
Ask about this problem
```

Example questions:

```text
Why did I fail this problem multiple times?
How should I review this problem?
Which problems share a similar mistake pattern?
```

## 4. Agent UI

### 4.1 Agent Drawer

The MVP should use a right-side drawer instead of a separate full page.

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

MVP prompts:

- What should I review tomorrow?
- What were my weakest topics this week?
- Which mistake reasons appear most often?
- Generate a review plan for Dynamic Programming.
- Which problems should I revisit before an interview?

### 4.3 Response Types

The agent should support structured responses, not only plain text.

```ts
type AgentResponse =
  | TextResponse
  | RecommendationResponse
  | PlanDraftResponse
  | ProblemExplanationResponse;
```

Example:

```text
You should review DP and edge cases first.

Recommended:
1. 322. Coin Change
2. 72. Edit Distance
3. 416. Partition Equal Subset Sum

[Add all to tomorrow]
[Create DP Sprint]
```

## 5. Agent Data Context

The MVP should read structured data first instead of passing all raw records.

Primary context:

- `ReviewInsightsSummary`
- `Problem`
- `SubmissionAttempt`
- `MistakeRecord`
- `ReviewState`
- `ReviewTask`
- `ReviewLog`

Recommended context flow:

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

The MVP can implement local tool-style functions first:

```ts
getWeeklySummary()
getReviewRecommendations()
getProblemHistory(problemId)
getMistakePatterns()
createReviewPlan(name)
addProblemsToPlan(planId, problemIds, date)
```

When LLM integration is added, these can become agent tools/function calls.

## 7. MVP Phases

### Phase 1: Local Mock Agent

No API required. Responses are generated from local rules and `ReviewInsightsSummary`.

Good first questions:

- What should I review tomorrow?
- What are my weak topics this week?
- Which mistake reasons are most common?
- Which problems should I review first?

### Phase 2: LLM Agent

Integrate OpenAI, Azure OpenAI, or AWS Bedrock.

LLM input:

- user question
- structured weekly summary
- relevant problem history
- available actions

LLM output:

- natural language answer
- structured action suggestions

Recommended model provider abstraction:

```ts
interface ModelProvider {
  complete(request: AgentRequest): Promise<AgentResponse>;
}
```

Future implementations:

- `OpenAIProvider`
- `AnthropicDirectProvider`
- `BedrockClaudeProvider`

Model routing modes:

- `fast`: emotional support, intro copy, lightweight summaries
- `balanced`: default chat, mistake summaries, short-term study plans
- `deep_reasoning`: complex interview strategy, multi-week planning, cross-topic reflection

The first LLM version should default to `auto + balanced`, while provider/model/mode can live in developer settings.

### Phase 3: Cloud Agent

After backend sync exists, the agent can run in the cloud:

```text
Chrome Extension
↓
Agent API
↓
PostgreSQL / Vector Store
↓
LLM Provider
```

Direct Claude API vs AWS Bedrock Claude:

- Direct Claude API: best for fast MVP validation, simpler integration, and direct prompt/model iteration.
- Bedrock Claude: best for AWS-native or enterprise deployment with IAM, CloudWatch, Guardrails, Knowledge Bases, AWS billing, and stronger enterprise data governance.
- The code should isolate these differences through `ModelProvider` adapters instead of coupling business logic to a specific provider.

## 8. Non-Goals

The Agent MVP will not include:

- importing the user's full LeetCode account history
- submitting code automatically
- directly modifying user code
- cloud sync
- long-term vector memory
- multi-user permission management

These belong in later versions.

## 9. Deferred TODOs

- Define a LeetLens Agent voice/tone guide, including intro copy, response style, encouragement level, and rules against inventing data.
- When LLM support is added, convert the voice/tone guide into a system prompt and add few-shot examples.
- Create evaluation cases for agent responses to verify data grounding, actionable review advice, and consistent tone.

## 10. Interview Positioning

Suggested description:

```text
Designed an agent-ready local context layer for a LeetCode mistake notebook. The agent MVP uses structured weekly insights, review states, mistake patterns, and scheduled tasks to answer personalized review questions and propose actionable study plans. The design supports a local mock agent first and can later be upgraded to an LLM-powered agent with tool calling and cloud sync.
```
