import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarCheck2,
  CircleAlert,
  Download,
  ListChecks,
  NotebookTabs,
  Archive,
  Bot,
  Pencil,
  PieChart,
  Plus,
  RefreshCw,
  Settings2,
  Target,
  Trash2,
  Upload,
  Wrench
} from "lucide-react";
import { mistakeTaxonomy } from "../shared/constants/mistakeTaxonomy";
import { removeDemoData, seedDemoData } from "../shared/db/repositories/demoDataRepository";
import { exportPortableData, importPortableData } from "../shared/db/repositories/portableDataRepository";
import {
  needsProblemMetadataRepair,
  repairProblemMetadata
} from "../shared/db/repositories/problemMetadataRepairRepository";
import { db } from "../shared/db/schema";
import {
  answerLocalAgentQuestion,
  buildAgentWelcomeMessage,
  suggestedAgentPrompts,
  type AgentMessage
} from "../shared/agent/localAgent";
import {
  buildReviewInsightsSummary,
  type ReviewInsightsSummary
} from "../shared/insights/reviewInsights";
import { createId } from "../shared/utils/ids";
import type { SubmissionAttempt } from "../shared/types/attempt";
import type { MistakeRecord } from "../shared/types/mistake";
import type { Problem } from "../shared/types/problem";
import type { ReviewPlan, ReviewTask } from "../shared/types/reviewPlan";
import type { ReviewLog, ReviewState } from "../shared/types/review";
import "./dashboard.css";

const AUTO_SEED_DEMO_DATA = false;
const ACTIVE_REVIEW_TASK_KEY = "leetlens.activeReviewTask";

type DashboardTab = "notebook" | "plans";
type NotebookSort = "time" | "frequency" | "topic" | "reason";
type Route = { name: "dashboard" } | { name: "detail"; problemId: string };

type DashboardData = {
  problems: Problem[];
  attempts: SubmissionAttempt[];
  mistakes: MistakeRecord[];
  reviewStates: ReviewState[];
  reviewPlans: ReviewPlan[];
  reviewLogs: ReviewLog[];
  reviewTasks: ReviewTask[];
};

type ProblemSummary = {
  problem: Problem;
  attempts: SubmissionAttempt[];
  mistakes: MistakeRecord[];
  reviewLogs: ReviewLog[];
  reviewState?: ReviewState;
  failureCount: number;
  latestAttempt?: SubmissionAttempt;
  latestMistake?: MistakeRecord;
  primaryReason: string;
  primaryTopic: string;
  lastFailedAt: string;
};

type TaskRow = {
  task: ReviewTask;
  summary?: ProblemSummary;
};

type Insight = {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
};

type MistakeEditInput = {
  primaryReason: string;
  secondaryReason?: string;
  note?: string;
};

function DashboardApp(): JSX.Element {
  const [data, setData] = useState<DashboardData>({
    problems: [],
    attempts: [],
    mistakes: [],
    reviewStates: [],
    reviewPlans: [],
    reviewLogs: [],
    reviewTasks: []
  });
  const [activeTab, setActiveTab] = useState<DashboardTab>("notebook");
  const [sortBy, setSortBy] = useState<NotebookSort>("time");
  const [reasonFilter, setReasonFilter] = useState("All");
  const [difficultyFilter, setDifficultyFilter] = useState("All");
  const [topicFilter, setTopicFilter] = useState("All");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [route, setRoute] = useState<Route>(getRouteFromHash());
  const [dataActionMessage, setDataActionMessage] = useState("");
  const [dataActionBusy, setDataActionBusy] = useState(false);
  const [agentDrawerOpen, setAgentDrawerOpen] = useState(false);
  const [agentInput, setAgentInput] = useState("");
  const [agentThinking, setAgentThinking] = useState(false);
  const agentReplyTimeoutRef = useRef<number | null>(null);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([
    {
      id: createId("agent_msg"),
      role: "agent",
      content: buildAgentWelcomeMessage()
    }
  ]);

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    return () => {
      if (agentReplyTimeoutRef.current !== null) {
        window.clearTimeout(agentReplyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const refreshOnFocus = (): void => {
      void loadDashboard();
    };

    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, []);

  useEffect(() => {
    const onHashChange = (): void => setRoute(getRouteFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const problemSummaries = useMemo(() => buildProblemSummaries(data), [data]);
  const insights = useMemo(() => buildInsights(data, problemSummaries), [data, problemSummaries]);
  const reviewInsights = useMemo(() => buildReviewInsightsSummary(data), [data]);
  const hasDemoRecords = useMemo(() => {
    return (
      data.attempts.some((attempt) => attempt.fingerprint.startsWith("demo-")) ||
      data.reviewPlans.some((plan) => plan.id.startsWith("demo_plan_"))
    );
  }, [data.attempts, data.reviewPlans]);
  const hasRepairableProblemMetadata = useMemo(() => {
    return data.problems.some(needsProblemMetadataRepair);
  }, [data.problems]);
  const selectedProblem = useMemo(() => {
    if (route.name !== "detail") {
      return undefined;
    }

    return problemSummaries.find((item) => item.problem.id === route.problemId);
  }, [problemSummaries, route]);

  const reasonOptions = useMemo(() => {
    return ["All", ...Array.from(new Set(problemSummaries.map((item) => item.primaryReason)))];
  }, [problemSummaries]);

  const topicOptions = useMemo(() => {
    return ["All", ...Array.from(new Set(problemSummaries.flatMap((item) => item.problem.tags)))];
  }, [problemSummaries]);

  const notebookRows = useMemo(() => {
    return problemSummaries
      .filter((item) => reasonFilter === "All" || item.primaryReason === reasonFilter)
      .filter((item) => difficultyFilter === "All" || item.problem.difficulty === difficultyFilter)
      .filter((item) => topicFilter === "All" || item.problem.tags.includes(topicFilter))
      .sort((a, b) => sortNotebookRows(a, b, sortBy));
  }, [difficultyFilter, problemSummaries, reasonFilter, sortBy, topicFilter]);

  const activeReviewPlans = useMemo(() => {
    return data.reviewPlans.filter((plan) => plan.active);
  }, [data.reviewPlans]);

  const selectedPlan = useMemo(() => {
    return activeReviewPlans.find((plan) => plan.id === selectedPlanId) ?? activeReviewPlans[0];
  }, [activeReviewPlans, selectedPlanId]);

  useEffect(() => {
    if (!selectedPlanId && activeReviewPlans.length) {
      setSelectedPlanId(activeReviewPlans[0].id);
      return;
    }

    if (selectedPlanId && activeReviewPlans.length && !activeReviewPlans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(activeReviewPlans[0].id);
      return;
    }

    if (selectedPlanId && !activeReviewPlans.length) {
      setSelectedPlanId("");
    }
  }, [activeReviewPlans, selectedPlanId]);

  const planDates = useMemo(() => getPlanDates(data.reviewTasks, selectedPlan?.id), [
    data.reviewTasks,
    selectedPlan?.id
  ]);

  const taskRows = useMemo(() => {
    const summaryByProblemId = new Map(
      problemSummaries.map((problemSummary) => [problemSummary.problem.id, problemSummary])
    );

    return data.reviewTasks
      .filter((task) => task.planId === selectedPlan?.id)
      .filter((task) => toDateKey(new Date(task.scheduledFor)) === selectedDate)
      .map((task) => ({ task, summary: summaryByProblemId.get(task.problemId) }))
      .sort(sortTaskRows);
  }, [data.reviewTasks, problemSummaries, selectedDate, selectedPlan?.id]);

  async function loadDashboard(): Promise<void> {
    if (AUTO_SEED_DEMO_DATA && (await db.reviewPlans.count()) === 0) {
      await seedDemoData();
    }

    const [problems, attempts, mistakes, reviewStates, reviewPlans, reviewLogs, reviewTasks] = await Promise.all([
      db.problems.toArray(),
      db.attempts.toArray(),
      db.mistakes.toArray(),
      db.reviewStates.toArray(),
      db.reviewPlans.toArray(),
      db.reviewLogs.toArray(),
      db.reviewTasks.toArray()
    ]);

    setData({ problems, attempts, mistakes, reviewStates, reviewPlans, reviewLogs, reviewTasks });

    const activePlans = reviewPlans.filter((plan) => plan.active);

    if (!selectedPlanId && activePlans.length) {
      setSelectedPlanId(activePlans[0].id);
    }
  }

  async function handleExportData(): Promise<void> {
    setDataActionBusy(true);
    setDataActionMessage("");

    try {
      const snapshot = await exportPortableData();
      const json = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `leetlens-export-${toDateKey(new Date())}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setDataActionMessage("Exported local data as JSON.");
    } catch (error) {
      setDataActionMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setDataActionBusy(false);
    }
  }

  async function handleImportData(file: File): Promise<void> {
    setDataActionBusy(true);
    setDataActionMessage("");

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const imported = await importPortableData(parsed);

      await loadDashboard();
      setDataActionMessage(
        `Imported ${imported.problems.length} problems and ${imported.reviewTasks.length} review tasks.`
      );
    } catch (error) {
      setDataActionMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setDataActionBusy(false);
    }
  }

  async function handleRemoveDemoData(): Promise<void> {
    const shouldRemove = window.confirm("Remove LeetLens demo data from this browser?");

    if (!shouldRemove) {
      return;
    }

    setDataActionBusy(true);
    setDataActionMessage("");

    try {
      const result = await removeDemoData();
      const deletedRecords =
        result.attempts +
        result.mistakes +
        result.plans +
        result.problems +
        result.reviewLogs +
        result.reviewStates +
        result.tasks;

      setSelectedPlanId("");
      await loadDashboard();
      setDataActionMessage(`Removed ${deletedRecords} demo records.`);
    } catch (error) {
      setDataActionMessage(error instanceof Error ? error.message : "Failed to remove demo data.");
    } finally {
      setDataActionBusy(false);
    }
  }

  async function handleRepairProblemMetadata(): Promise<void> {
    setDataActionBusy(true);
    setDataActionMessage("");

    try {
      const result = await repairProblemMetadata();

      await loadDashboard();
      setDataActionMessage(
        `Metadata repair finished: ${result.repaired} repaired, ${result.failed} failed, ${result.skipped} skipped.`
      );
    } catch (error) {
      setDataActionMessage(error instanceof Error ? error.message : "Metadata repair failed.");
    } finally {
      setDataActionBusy(false);
    }
  }

  async function handleCreatePlan(name: string): Promise<void> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setDataActionMessage("Plan name is required.");
      return;
    }

    const now = new Date().toISOString();
    const plan: ReviewPlan = {
      id: createId("review_plan"),
      name: trimmedName,
      type: "custom",
      description: "Custom review plan.",
      active: true,
      createdAt: now,
      updatedAt: now
    };

    await db.reviewPlans.add(plan);
    setSelectedPlanId(plan.id);
    setActiveTab("plans");
    setDataActionMessage(`Created plan "${plan.name}".`);
    await loadDashboard();
  }

  async function handleRenamePlan(planId: string, name: string): Promise<void> {
    const trimmedName = name.trim();

    if (!planId || !trimmedName) {
      setDataActionMessage("Choose a plan and enter a new name.");
      return;
    }

    await db.reviewPlans.update(planId, {
      name: trimmedName,
      updatedAt: new Date().toISOString()
    });
    setDataActionMessage(`Renamed plan to "${trimmedName}".`);
    await loadDashboard();
  }

  async function handleSetPlanActive(planId: string, active: boolean): Promise<void> {
    await db.reviewPlans.update(planId, {
      active,
      updatedAt: new Date().toISOString()
    });

    if (!active && selectedPlanId === planId) {
      const nextPlan = data.reviewPlans.find((plan) => plan.active && plan.id !== planId);
      setSelectedPlanId(nextPlan?.id ?? "");
    }

    if (active) {
      setSelectedPlanId(planId);
    }

    setDataActionMessage(active ? "Restored review plan." : "Archived review plan.");
    await loadDashboard();
  }

  async function handleAddProblemToPlan(input: {
    problemId: string;
    planId: string;
    scheduledFor: string;
    latestAttemptId?: string;
  }): Promise<void> {
    if (!input.planId) {
      setDataActionMessage("Choose a review plan first.");
      return;
    }

    if (!input.scheduledFor) {
      setDataActionMessage("Choose a review date first.");
      return;
    }

    const scheduledFor = dateKeyToIso(input.scheduledFor);
    const existingTask = await db.reviewTasks
      .filter(
        (task) =>
          task.planId === input.planId &&
          task.problemId === input.problemId &&
          toDateKey(new Date(task.scheduledFor)) === input.scheduledFor
      )
      .first();
    const now = new Date().toISOString();

    if (existingTask) {
      await db.reviewTasks.update(existingTask.id, {
        status: "todo",
        scheduledFor,
        latestAttemptId: input.latestAttemptId,
        updatedAt: now
      });
    } else {
      await db.reviewTasks.add({
        id: createId("review_task"),
        planId: input.planId,
        problemId: input.problemId,
        scheduledFor,
        status: "todo",
        source: "manual",
        latestAttemptId: input.latestAttemptId,
        createdAt: now,
        updatedAt: now
      });
    }

    const planName = data.reviewPlans.find((plan) => plan.id === input.planId)?.name ?? "review plan";
    setDataActionMessage(`Added problem to ${planName} on ${formatDateTab(input.scheduledFor)}.`);
    await loadDashboard();
  }

  async function handleRemoveTask(taskId: string): Promise<void> {
    await db.reviewTasks.delete(taskId);
    setDataActionMessage("Removed review task.");
    await loadDashboard();
  }

  async function handleUpdateMistake(mistakeId: string, input: MistakeEditInput): Promise<void> {
    const primaryReason = input.primaryReason.trim();

    if (!primaryReason) {
      setDataActionMessage("Primary reason is required.");
      return;
    }

    await db.mistakes.update(mistakeId, {
      primaryReason,
      secondaryReason: input.secondaryReason?.trim() || undefined,
      note: input.note?.trim() || undefined,
      confidence: "user_confirmed",
      updatedAt: new Date().toISOString()
    });
    setDataActionMessage("Updated mistake record.");
    await loadDashboard();
  }

  function handleAskAgent(question: string): void {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || agentThinking) {
      return;
    }

    setAgentMessages((messages) => [
      ...messages,
      {
        id: createId("agent_msg"),
        role: "user",
        content: trimmedQuestion
      }
    ]);
    setAgentInput("");
    setAgentDrawerOpen(true);
    setAgentThinking(true);

    if (agentReplyTimeoutRef.current !== null) {
      window.clearTimeout(agentReplyTimeoutRef.current);
    }

    agentReplyTimeoutRef.current = window.setTimeout(() => {
      const answer = answerLocalAgentQuestion({
        question: trimmedQuestion,
        summary: reviewInsights
      });

      setAgentMessages((messages) => [
        ...messages,
        {
          id: createId("agent_msg"),
          role: "agent",
          content: answer
        }
      ]);
      setAgentThinking(false);
      agentReplyTimeoutRef.current = null;
    }, 2000);
  }

  if (route.name === "detail") {
    return (
      <DashboardShell
        dataActionBusy={dataActionBusy}
        dataActionMessage={dataActionMessage}
        hasDemoRecords={hasDemoRecords}
        hasRepairableProblemMetadata={hasRepairableProblemMetadata}
        insights={insights}
        onExport={() => void handleExportData()}
        onImport={(file) => void handleImportData(file)}
        onRemoveDemoData={() => void handleRemoveDemoData()}
        onRepairProblemMetadata={() => void handleRepairProblemMetadata()}
        onRefresh={() => void loadDashboard()}
      >
        {selectedProblem ? (
          <ProblemDetail
            summary={selectedProblem}
            onUpdateMistake={(mistakeId, input) => void handleUpdateMistake(mistakeId, input)}
          />
        ) : (
          <EmptyState title="Problem not found" description="This record may have been deleted." />
        )}
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      dataActionBusy={dataActionBusy}
      dataActionMessage={dataActionMessage}
      hasDemoRecords={hasDemoRecords}
      hasRepairableProblemMetadata={hasRepairableProblemMetadata}
      insights={insights}
      onExport={() => void handleExportData()}
      onImport={(file) => void handleImportData(file)}
      onRemoveDemoData={() => void handleRemoveDemoData()}
      onRepairProblemMetadata={() => void handleRepairProblemMetadata()}
      onRefresh={() => void loadDashboard()}
    >
      <nav className="dashboard__tabs" aria-label="Dashboard tabs">
        <button
          className={activeTab === "notebook" ? "dashboard__tab dashboard__tab--active" : "dashboard__tab"}
          type="button"
          onClick={() => setActiveTab("notebook")}
        >
          <NotebookTabs size={17} />
          Mistake Notebook
        </button>
        <button
          className={activeTab === "plans" ? "dashboard__tab dashboard__tab--active" : "dashboard__tab"}
          type="button"
          onClick={() => setActiveTab("plans")}
        >
          <CalendarCheck2 size={17} />
          Review Plans
        </button>
      </nav>

      <WeeklySummary summary={reviewInsights} onAskAgent={handleAskAgent} />

      {activeTab === "notebook" ? (
        <MistakeNotebook
          plans={activeReviewPlans}
          rows={notebookRows}
          sortBy={sortBy}
          reasonFilter={reasonFilter}
          difficultyFilter={difficultyFilter}
          topicFilter={topicFilter}
          reasonOptions={reasonOptions}
          topicOptions={topicOptions}
          selectedPlanId={selectedPlan?.id ?? ""}
          selectedDate={selectedDate}
          onAddToPlan={(input) => void handleAddProblemToPlan(input)}
          onSortChange={setSortBy}
          onReasonChange={setReasonFilter}
          onDifficultyChange={setDifficultyFilter}
          onTopicChange={setTopicFilter}
        />
      ) : (
        <ReviewPlans
          activePlans={activeReviewPlans}
          plans={data.reviewPlans}
          selectedPlan={selectedPlan}
          selectedDate={selectedDate}
          dates={planDates}
          taskRows={taskRows}
          onCreatePlan={(name) => void handleCreatePlan(name)}
          onRenamePlan={(planId, name) => void handleRenamePlan(planId, name)}
          onRemoveTask={(taskId) => void handleRemoveTask(taskId)}
          onSetPlanActive={(planId, active) => void handleSetPlanActive(planId, active)}
          onTaskOpened={() => void loadDashboard()}
          onPlanChange={setSelectedPlanId}
          onDateChange={setSelectedDate}
        />
      )}
      <button className="dashboard__agentLauncher" type="button" onClick={() => setAgentDrawerOpen(true)}>
        <Bot size={17} />
        Ask LeetLens
      </button>
      <AgentDrawer
        input={agentInput}
        isThinking={agentThinking}
        messages={agentMessages}
        open={agentDrawerOpen}
        onAsk={handleAskAgent}
        onClose={() => setAgentDrawerOpen(false)}
        onInputChange={setAgentInput}
      />
    </DashboardShell>
  );
}

function DashboardShell({
  children,
  dataActionBusy,
  dataActionMessage,
  hasDemoRecords,
  hasRepairableProblemMetadata,
  insights,
  onExport,
  onImport,
  onRemoveDemoData,
  onRepairProblemMetadata,
  onRefresh
}: {
  children: React.ReactNode;
  dataActionBusy: boolean;
  dataActionMessage: string;
  hasDemoRecords: boolean;
  hasRepairableProblemMetadata: boolean;
  insights: Insight[];
  onExport: () => void;
  onImport: (file: File) => void;
  onRemoveDemoData: () => void;
  onRepairProblemMetadata: () => void;
  onRefresh: () => void;
}): JSX.Element {
  function handleImportChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];

    event.currentTarget.value = "";

    if (file) {
      onImport(file);
    }
  }

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">LeetLens MVP</p>
          <h1>Dashboard</h1>
        </div>
        <div className="dashboard__headerActions">
          <button className="dashboard__ghostButton" type="button" onClick={onRefresh}>
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            className="dashboard__ghostButton"
            disabled={dataActionBusy}
            type="button"
            onClick={onExport}
          >
            <Download size={15} />
            Export JSON
          </button>
          <label
            className={
              dataActionBusy ? "dashboard__ghostButton dashboard__ghostButton--disabled" : "dashboard__ghostButton"
            }
          >
            <Upload size={15} />
            Import JSON
            <input
              accept="application/json,.json"
              disabled={dataActionBusy}
              hidden
              type="file"
              onChange={handleImportChange}
            />
          </label>
          {hasRepairableProblemMetadata ? (
            <button
              className="dashboard__ghostButton"
              disabled={dataActionBusy}
              type="button"
              onClick={onRepairProblemMetadata}
            >
              <Wrench size={15} />
              Repair metadata
            </button>
          ) : null}
          {hasDemoRecords ? (
            <button
              className="dashboard__dangerButton"
              disabled={dataActionBusy}
              type="button"
              onClick={onRemoveDemoData}
            >
              <Trash2 size={15} />
              Remove demo data
            </button>
          ) : null}
        </div>
      </header>

      {dataActionMessage ? <p className="dashboard__dataMessage">{dataActionMessage}</p> : null}

      <section className="dashboard__insights" aria-label="Dashboard insights">
        {insights.map((insight) => (
          <InsightCard insight={insight} key={insight.label} />
        ))}
      </section>

      {children}
    </main>
  );
}

function InsightCard({ insight }: { insight: Insight }): JSX.Element {
  return (
    <article className="dashboard__insight">
      <div className="dashboard__insightIcon">{insight.icon}</div>
      <div>
        <span>{insight.label}</span>
        <strong>{insight.value}</strong>
        <p>{insight.detail}</p>
      </div>
    </article>
  );
}

function AgentDrawer({
  input,
  isThinking,
  messages,
  open,
  onAsk,
  onClose,
  onInputChange
}: {
  input: string;
  isThinking: boolean;
  messages: AgentMessage[];
  open: boolean;
  onAsk: (question: string) => void;
  onClose: () => void;
  onInputChange: (value: string) => void;
}): JSX.Element | null {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [isThinking, messages, open]);

  if (!open) {
    return null;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onAsk(input);
  }

  return (
    <aside className="dashboard__agentDrawer" aria-label="LeetLens Agent">
      <div className="dashboard__agentHeader">
        <div>
          <p className="dashboard__eyebrow">LeetLens Agent</p>
          <h2>Local review assistant</h2>
        </div>
        <button className="dashboard__ghostButton" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <p className="dashboard__agentContext">Using your local mistake notebook and weekly review summary.</p>

      <section className="dashboard__agentGuide" aria-label="Suggested agent questions">
        <p>I can read your review summary and help you choose the next move. Try one of these:</p>
        <ol>
          {suggestedAgentPrompts.slice(0, 4).map((prompt, index) => (
            <li key={prompt.id}>
              <button
                className="dashboard__agentQuestion"
                disabled={isThinking}
                type="button"
                onClick={() => onAsk(prompt.question)}
              >
                <span>{index + 1}</span>
                {prompt.question}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="dashboard__agentMessages" aria-label="Agent conversation">
        {messages.map((message) => (
          <article
            className={
              message.role === "user"
                ? "dashboard__agentMessage dashboard__agentMessage--user"
                : "dashboard__agentMessage"
            }
            key={message.id}
          >
            <span>{message.role === "user" ? "You" : "LeetLens"}</span>
            <p>{message.content}</p>
          </article>
        ))}
        {isThinking ? (
          <article className="dashboard__agentMessage dashboard__agentMessage--thinking">
            <span>LeetLens</span>
            <p>
              <span className="dashboard__typingDots" aria-label="LeetLens is thinking">
                <i />
                <i />
                <i />
              </span>
            </p>
          </article>
        ) : null}
        <div ref={messagesEndRef} />
      </section>

      <form className="dashboard__agentComposer" onSubmit={handleSubmit}>
        <textarea
          disabled={isThinking}
          placeholder="Ask about tomorrow, weak topics, or interview review..."
          rows={3}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
        />
        <button className="dashboard__tableLink" disabled={!input.trim() || isThinking} type="submit">
          {isThinking ? "Thinking" : "Ask"}
        </button>
      </form>
    </aside>
  );
}

function WeeklySummary({
  summary,
  onAskAgent
}: {
  summary: ReviewInsightsSummary;
  onAskAgent: (question: string) => void;
}): JSX.Element {
  const quickPrompts = suggestedAgentPrompts.slice(0, 3);

  return (
    <section className="dashboard__weeklySummary" aria-label="Weekly review summary">
      <div className="dashboard__sectionHeader">
        <div>
          <p className="dashboard__eyebrow">Weekly Summary</p>
          <h2>Review insights</h2>
        </div>
        <div className="dashboard__summaryActions">
          {quickPrompts.map((prompt) => (
            <button
              className="dashboard__summaryAskButton"
              key={prompt.id}
              type="button"
              onClick={() => onAskAgent(prompt.question)}
            >
              <Bot size={14} />
              {prompt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard__summaryGrid">
        <SummaryMetric label="Attempts" value={summary.weeklyAttemptCount} />
        <SummaryMetric label="Failed" value={summary.weeklyFailedAttemptCount} />
        <SummaryMetric label="Reviewed" value={summary.weeklyReviewedCount} />
        <SummaryMetric label="Failed again" value={summary.failedAgainCount} />
        <SummaryMetric label="Due today" value={summary.dueTodayCount} />
        <SummaryMetric label="Due tomorrow" value={summary.dueTomorrowCount} />
      </div>

      <div className="dashboard__summaryColumns">
        <RankedList title="Top reasons" rows={summary.topMistakeReasons} />
        <RankedList title="Weak topics" rows={summary.weakestTopics} />
        <section className="dashboard__summaryColumn">
          <h3>Recommended reviews</h3>
          {summary.recommendedReviews.length ? (
            <div className="dashboard__recommendations">
              {summary.recommendedReviews.map((item) => (
                <div className="dashboard__recommendation" key={item.problemId}>
                  <strong>
                    {item.leetcodeId ? `${item.leetcodeId}. ` : ""}
                    {item.title}
                  </strong>
                  <p>
                    {item.topic} | {item.reason}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard__summaryEmpty">No recommendations yet.</p>
          )}
        </section>
      </div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="dashboard__summaryMetric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RankedList({
  title,
  rows
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
}): JSX.Element {
  return (
    <section className="dashboard__summaryColumn">
      <h3>{title}</h3>
      {rows.length ? (
        <ol className="dashboard__rankedList">
          {rows.map((row) => (
            <li key={row.label}>
              <span>{row.label}</span>
              <strong>{row.count}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="dashboard__summaryEmpty">No data yet.</p>
      )}
    </section>
  );
}

function MistakeNotebook({
  plans,
  rows,
  sortBy,
  reasonFilter,
  difficultyFilter,
  topicFilter,
  reasonOptions,
  topicOptions,
  selectedPlanId,
  selectedDate,
  onAddToPlan,
  onSortChange,
  onReasonChange,
  onDifficultyChange,
  onTopicChange
}: {
  plans: ReviewPlan[];
  rows: ProblemSummary[];
  sortBy: NotebookSort;
  reasonFilter: string;
  difficultyFilter: string;
  topicFilter: string;
  reasonOptions: string[];
  topicOptions: string[];
  selectedPlanId: string;
  selectedDate: string;
  onAddToPlan: (input: {
    problemId: string;
    planId: string;
    scheduledFor: string;
    latestAttemptId?: string;
  }) => void;
  onSortChange: (value: NotebookSort) => void;
  onReasonChange: (value: string) => void;
  onDifficultyChange: (value: string) => void;
  onTopicChange: (value: string) => void;
}): JSX.Element {
  const [targetPlanId, setTargetPlanId] = useState(selectedPlanId);
  const [targetDate, setTargetDate] = useState(selectedDate);
  const [pendingRow, setPendingRow] = useState<ProblemSummary | undefined>();

  useEffect(() => {
    if (!targetPlanId && selectedPlanId) {
      setTargetPlanId(selectedPlanId);
    }
  }, [selectedPlanId, targetPlanId]);

  function handleAddSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!pendingRow) {
      return;
    }

    onAddToPlan({
      problemId: pendingRow.problem.id,
      planId: targetPlanId,
      scheduledFor: targetDate,
      latestAttemptId: pendingRow.latestAttempt?.id
    });
    setPendingRow(undefined);
  }

  return (
    <section className="dashboard__panel">
      <div className="dashboard__sectionHeader">
        <div>
          <p className="dashboard__eyebrow">Mistake Notebook</p>
          <h2>{rows.length} tracked problems</h2>
        </div>
      </div>

      <section className="dashboard__toolbar dashboard__toolbar--compact">
        <label>
          Sort by
          <select value={sortBy} onChange={(event) => onSortChange(event.target.value as NotebookSort)}>
            <option value="time">Time</option>
            <option value="frequency">Frequency</option>
            <option value="topic">Topic</option>
            <option value="reason">Reason</option>
          </select>
        </label>
        <label>
          Topic
          <select value={topicFilter} onChange={(event) => onTopicChange(event.target.value)}>
            {topicOptions.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reason
          <select value={reasonFilter} onChange={(event) => onReasonChange(event.target.value)}>
            {reasonOptions.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
        </label>
        <label>
          Difficulty
          <select value={difficultyFilter} onChange={(event) => onDifficultyChange(event.target.value)}>
            {["All", "Easy", "Medium", "Hard", "Unknown"].map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {difficulty}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="dashboard__tableWrap">
        <table className="dashboard__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Problem</th>
              <th>Difficulty</th>
              <th>Topic</th>
              <th>Reason</th>
              <th>Fails</th>
              <th>Last Failed</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.problem.id}>
                <td>{row.problem.leetcodeId ?? "--"}</td>
                <td>{row.problem.title}</td>
                <td>{row.problem.difficulty}</td>
                <td>{row.primaryTopic}</td>
                <td>{row.primaryReason}</td>
                <td>{row.failureCount}</td>
                <td>{formatDate(row.lastFailedAt)}</td>
                <td>
                  <div className="dashboard__rowActions">
                    <a className="dashboard__tableLink" href={`#problem=${row.problem.id}`}>
                      Detail
                    </a>
                    <button
                      className="dashboard__ghostButton"
                      disabled={!plans.length}
                      type="button"
                      onClick={() => setPendingRow(row)}
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pendingRow ? (
        <div className="dashboard__modalBackdrop" role="presentation">
          <form className="dashboard__modal" onSubmit={handleAddSubmit}>
            <div className="dashboard__modalHeader">
              <div>
                <p className="dashboard__eyebrow">Add to plan</p>
                <h3>{pendingRow.problem.title}</h3>
              </div>
              <button
                className="dashboard__ghostButton"
                type="button"
                onClick={() => setPendingRow(undefined)}
              >
                Cancel
              </button>
            </div>
            <label>
              Review plan
              <select value={targetPlanId} onChange={(event) => setTargetPlanId(event.target.value)}>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Review date
              <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
            </label>
            <div className="dashboard__modalActions">
              <button className="dashboard__ghostButton" type="button" onClick={() => setPendingRow(undefined)}>
                Cancel
              </button>
              <button className="dashboard__tableLink" disabled={!targetPlanId || !targetDate} type="submit">
                <Plus size={14} />
                Add
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function ReviewPlans({
  activePlans,
  plans,
  selectedPlan,
  selectedDate,
  dates,
  taskRows,
  onCreatePlan,
  onRenamePlan,
  onRemoveTask,
  onSetPlanActive,
  onTaskOpened,
  onPlanChange,
  onDateChange
}: {
  activePlans: ReviewPlan[];
  plans: ReviewPlan[];
  selectedPlan?: ReviewPlan;
  selectedDate: string;
  dates: string[];
  taskRows: TaskRow[];
  onCreatePlan: (name: string) => void;
  onRenamePlan: (planId: string, name: string) => void;
  onRemoveTask: (taskId: string) => void;
  onSetPlanActive: (planId: string, active: boolean) => void;
  onTaskOpened: () => void;
  onPlanChange: (planId: string) => void;
  onDateChange: (date: string) => void;
}): JSX.Element {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [editingPlanId, setEditingPlanId] = useState("");
  const [editingPlanName, setEditingPlanName] = useState("");

  async function openTask(task: ReviewTask, summary?: ProblemSummary): Promise<void> {
    if (!summary) {
      return;
    }

    const now = new Date().toISOString();
    await chrome.storage.local.set({
      [ACTIVE_REVIEW_TASK_KEY]: {
        taskId: task.id,
        planId: task.planId,
        problemId: task.problemId,
        problemSlug: summary.problem.slug,
        scheduledFor: task.scheduledFor,
        openedAt: now
      }
    });

    if (task.status === "todo") {
      await db.reviewTasks.update(task.id, {
        status: "in_progress",
        openedAt: now,
        updatedAt: now
      });
      onTaskOpened();
    }

    window.open(summary.problem.url, "_blank", "noopener,noreferrer");
  }

  function handleCreatePlan(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!newPlanName.trim()) {
      return;
    }

    onCreatePlan(newPlanName);
    setNewPlanName("");
    setCreateModalOpen(false);
  }

  function handleRenamePlan(event: React.FormEvent<HTMLFormElement>, planId: string): void {
    event.preventDefault();

    if (!editingPlanName.trim()) {
      return;
    }

    onRenamePlan(planId, editingPlanName);
    setEditingPlanId("");
    setEditingPlanName("");
  }

  function startEditingPlan(plan: ReviewPlan): void {
    setEditingPlanId(plan.id);
    setEditingPlanName(plan.name);
  }

  return (
    <section className="dashboard__panel">
      <div className="dashboard__reviewPlanHeader">
        <div className="dashboard__reviewPlanPicker">
          <label className="dashboard__primaryPlanSelect">
            <span>Review plan</span>
            <select
              disabled={!activePlans.length}
              value={selectedPlan?.id ?? ""}
              onChange={(event) => onPlanChange(event.target.value)}
            >
              {activePlans.length ? (
                activePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))
              ) : (
                <option value="">No active plans</option>
              )}
            </select>
          </label>
          {selectedPlan?.description ? <p className="dashboard__sectionText">{selectedPlan.description}</p> : null}
        </div>
        <div className="dashboard__planActions">
          <button className="dashboard__ghostButton" type="button" onClick={() => setCreateModalOpen(true)}>
            <Plus size={14} />
            Create new plan
          </button>
          <button className="dashboard__ghostButton" type="button" onClick={() => setManageModalOpen(true)}>
            <Settings2 size={14} />
            Manage plans
          </button>
        </div>
      </div>

      <div className="dashboard__dateTabs" aria-label="Review dates">
        {dates.map((date) => (
          <button
            key={date}
            className={
              date === selectedDate ? "dashboard__dateTab dashboard__dateTab--active" : "dashboard__dateTab"
            }
            type="button"
            onClick={() => onDateChange(date)}
          >
            {formatDateTab(date)}
          </button>
        ))}
      </div>

      <div className="dashboard__tableWrap">
        <table className="dashboard__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Problem</th>
              <th>Topic</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {taskRows.map(({ task, summary }) => (
              <tr className={task.status === "done" ? "dashboard__taskRow--done" : ""} key={task.id}>
                <td>{summary?.problem.leetcodeId ?? "--"}</td>
                <td>{summary?.problem.title ?? "Unknown problem"}</td>
                <td>{summary?.primaryTopic ?? "--"}</td>
                <td>{summary?.primaryReason ?? "--"}</td>
                <td>
                  <span className={`dashboard__status dashboard__status--${task.status}`}>
                    {formatTaskStatus(task.status)}
                  </span>
                </td>
                <td>
                  <div className="dashboard__rowActions">
                    {summary?.problem.url ? (
                      <button
                        className="dashboard__tableLink"
                        type="button"
                        onClick={() => void openTask(task, summary)}
                      >
                        Go
                      </button>
                    ) : (
                      "--"
                    )}
                    <button
                      className="dashboard__dangerButton"
                      type="button"
                      onClick={() => onRemoveTask(task.id)}
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!taskRows.length ? (
          <EmptyState title="No tasks for this date" description="Choose another day or review plan." />
        ) : null}
      </div>

      {createModalOpen ? (
        <div className="dashboard__modalBackdrop" role="presentation">
          <form className="dashboard__modal" onSubmit={handleCreatePlan}>
            <div className="dashboard__modalHeader">
              <div>
                <p className="dashboard__eyebrow">Create plan</p>
                <h3>New review plan</h3>
              </div>
              <button className="dashboard__ghostButton" type="button" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </button>
            </div>
            <label>
              Plan name
              <input
                autoFocus
                placeholder="DP Sprint"
                type="text"
                value={newPlanName}
                onChange={(event) => setNewPlanName(event.target.value)}
              />
            </label>
            <div className="dashboard__modalActions">
              <button className="dashboard__ghostButton" type="button" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </button>
              <button className="dashboard__tableLink" type="submit">
                <Plus size={14} />
                Create
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {manageModalOpen ? (
        <div className="dashboard__modalBackdrop" role="presentation">
          <section className="dashboard__modal dashboard__modal--wide">
            <div className="dashboard__modalHeader">
              <div>
                <p className="dashboard__eyebrow">Manage plans</p>
                <h3>Plan list</h3>
              </div>
              <button className="dashboard__ghostButton" type="button" onClick={() => setManageModalOpen(false)}>
                Close
              </button>
            </div>
            <div className="dashboard__planList">
              {plans.map((plan) => (
                <div className="dashboard__planListItem" key={plan.id}>
                  {editingPlanId === plan.id ? (
                    <form className="dashboard__planEditForm" onSubmit={(event) => handleRenamePlan(event, plan.id)}>
                      <input
                        autoFocus
                        type="text"
                        value={editingPlanName}
                        onChange={(event) => setEditingPlanName(event.target.value)}
                      />
                      <button className="dashboard__tableLink" type="submit">
                        Save
                      </button>
                      <button
                        className="dashboard__ghostButton"
                        type="button"
                        onClick={() => {
                          setEditingPlanId("");
                          setEditingPlanName("");
                        }}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <div>
                        <strong>{plan.name}</strong>
                        <p>{plan.active ? "Active" : "Archived"}</p>
                      </div>
                      <div className="dashboard__rowActions">
                        <button className="dashboard__ghostButton" type="button" onClick={() => startEditingPlan(plan)}>
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          className={plan.active ? "dashboard__dangerButton" : "dashboard__ghostButton"}
                          type="button"
                          onClick={() => onSetPlanActive(plan.id, !plan.active)}
                        >
                          <Archive size={14} />
                          {plan.active ? "Archive" : "Restore"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function ProblemDetail({
  summary,
  onUpdateMistake
}: {
  summary: ProblemSummary;
  onUpdateMistake: (mistakeId: string, input: MistakeEditInput) => void;
}): JSX.Element {
  const { problem, attempts, mistakes, reviewLogs, reviewState } = summary;
  const mistakeByAttemptId = new Map(mistakes.map((mistake) => [mistake.attemptId, mistake]));

  return (
    <section className="dashboard__detail">
      <a className="dashboard__backLink" href="#">
        Back to dashboard
      </a>

      <div className="dashboard__detailHeader">
        <div>
          <p className="dashboard__meta">
            {problem.leetcodeId ? `${problem.leetcodeId} | ` : ""}
            {problem.difficulty}
          </p>
          <h2>{problem.title}</h2>
          <TagList tags={problem.tags} />
        </div>
        <a className="dashboard__link" href={problem.url} target="_blank" rel="noreferrer">
          Open on LeetCode
        </a>
      </div>

      <section className="dashboard__detailGrid">
        <DetailStat label="Failure count" value={summary.failureCount} />
        <DetailStat label="Primary reason" value={summary.primaryReason} />
        <DetailStat label="Review status" value={formatReviewStatus(reviewState)} />
        <DetailStat label="Next review" value={formatDateTime(reviewState?.nextReviewAt)} />
        <DetailStat label="Mastery" value={reviewState ? `${reviewState.mastery}/5` : "--"} />
        <DetailStat label="Review count" value={reviewState?.reviewCount ?? "--"} />
        <DetailStat label="Positive streak" value={reviewState?.positiveStreak ?? "--"} />
        <DetailStat label="Last reviewed" value={formatDateTime(reviewState?.lastReviewedAt)} />
      </section>

      <section className="dashboard__detailSection" aria-label="Review history">
        <h3>Review History</h3>
        {reviewLogs.length ? (
          <ol className="dashboard__timeline">
            {reviewLogs.map((log) => (
              <li key={log.id}>
                <strong>{formatReviewLogResult(log.result)}</strong>
                <span>{formatDateTime(log.reviewedAt)}</span>
                {log.note ? <p>{log.note}</p> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="dashboard__summaryEmpty">No review logs yet.</p>
        )}
      </section>

      <section className="dashboard__attempts" aria-label="Failed attempt history">
        <h3>Submission History</h3>
        {attempts.length ? (
          attempts.map((attempt) => (
            <AttemptPanel
              key={attempt.id}
              attempt={attempt}
              mistake={mistakeByAttemptId.get(attempt.id)}
              onUpdateMistake={onUpdateMistake}
            />
          ))
        ) : (
          <EmptyState title="No attempts found" description="This problem has no stored attempts." />
        )}
      </section>
    </section>
  );
}

function AttemptPanel({
  attempt,
  mistake,
  onUpdateMistake
}: {
  attempt: SubmissionAttempt;
  mistake?: MistakeRecord;
  onUpdateMistake: (mistakeId: string, input: MistakeEditInput) => void;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [primaryReason, setPrimaryReason] = useState(mistake?.primaryReason ?? "Uncategorized");
  const [secondaryReason, setSecondaryReason] = useState(mistake?.secondaryReason ?? "");
  const [note, setNote] = useState(mistake?.note ?? "");
  const secondaryReasonOptions = getSecondaryReasonOptions(primaryReason);

  useEffect(() => {
    setPrimaryReason(mistake?.primaryReason ?? "Uncategorized");
    setSecondaryReason(mistake?.secondaryReason ?? "");
    setNote(mistake?.note ?? "");
  }, [mistake]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!mistake) {
      return;
    }

    onUpdateMistake(mistake.id, {
      primaryReason,
      secondaryReason,
      note
    });
    setIsEditing(false);
  }

  return (
    <article className="dashboard__attempt">
      <div className="dashboard__attemptHeader">
        <div>
          <p className="dashboard__meta">{formatDateTime(attempt.submittedAt)}</p>
          <h4>
            {attempt.result} | {attempt.language}
          </h4>
        </div>
        <div className="dashboard__rowActions">
          <span className="dashboard__captureStatus">{attempt.codeCaptureStatus}</span>
          {mistake ? (
            <button className="dashboard__ghostButton" type="button" onClick={() => setIsEditing((value) => !value)}>
              <Pencil size={14} />
              {isEditing ? "Close" : "Edit"}
            </button>
          ) : null}
        </div>
      </div>

      {isEditing && mistake ? (
        <form className="dashboard__mistakeForm" onSubmit={handleSubmit}>
          <label>
            Primary reason
            <select
              value={primaryReason}
              onChange={(event) => {
                setPrimaryReason(event.target.value);
                setSecondaryReason("");
              }}
            >
              <option value="Uncategorized">Uncategorized</option>
              {mistakeTaxonomy.map((item) => (
                <option key={item.primaryReason} value={item.primaryReason}>
                  {item.primaryReason}
                </option>
              ))}
            </select>
          </label>
          <label>
            Secondary reason
            <select value={secondaryReason} onChange={(event) => setSecondaryReason(event.target.value)}>
              <option value="">None</option>
              {secondaryReasonOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="dashboard__mistakeFormNote">
            Note
            <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="dashboard__modalActions">
            <button className="dashboard__ghostButton" type="button" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
            <button className="dashboard__tableLink" type="submit">
              Save
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="dashboard__attemptMeta">
            <span>{mistake?.primaryReason ?? "Uncategorized"}</span>
            {mistake?.secondaryReason ? <span>{mistake.secondaryReason}</span> : null}
          </div>

          {mistake?.note ? <p className="dashboard__note">{mistake.note}</p> : null}
        </>
      )}
      {attempt.errorMessage ? <pre className="dashboard__errorText">{attempt.errorMessage}</pre> : null}
      <pre className="dashboard__code">
        <code>{attempt.code || "Code was not captured for this attempt."}</code>
      </pre>
    </article>
  );
}

function DetailStat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="dashboard__detailStat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TagList({ tags }: { tags: string[] }): JSX.Element | null {
  if (!tags.length) {
    return null;
  }

  return (
    <div className="dashboard__tags">
      {tags.slice(0, 6).map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }): JSX.Element {
  return (
    <div className="dashboard__empty">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function buildInsights(data: DashboardData, problemSummaries: ProblemSummary[]): Insight[] {
  const today = toDateKey(new Date());
  const todayTasks = data.reviewTasks.filter(
    (task) => toDateKey(new Date(task.scheduledFor)) === today
  );
  const completedToday = todayTasks.filter((task) => task.status === "done").length;
  const completionPercent = todayTasks.length
    ? Math.round((completedToday / todayTasks.length) * 100)
    : 0;

  const reasonCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();

  for (const mistake of data.mistakes) {
    reasonCounts.set(mistake.primaryReason, (reasonCounts.get(mistake.primaryReason) ?? 0) + 1);
  }

  for (const summary of problemSummaries) {
    topicCounts.set(summary.primaryTopic, (topicCounts.get(summary.primaryTopic) ?? 0) + summary.failureCount);
  }

  const topReason = getHighestCountEntry(reasonCounts, "No mistakes");
  const topTopic = getHighestCountEntry(topicCounts, "No topic");
  const reasonPercent = data.mistakes.length
    ? Math.round((topReason.count / data.mistakes.length) * 100)
    : 0;
  const openTasks = data.reviewTasks.filter((task) =>
    ["todo", "in_progress", "failed_today"].includes(task.status)
  ).length;

  return [
    {
      label: "今日计划完成度",
      value: `${completionPercent}%`,
      detail: `${completedToday}/${todayTasks.length} tasks done`,
      icon: <ListChecks size={20} />
    },
    {
      label: "错因占比",
      value: `${reasonPercent}%`,
      detail: topReason.key,
      icon: <PieChart size={20} />
    },
    {
      label: "重点题型",
      value: topTopic.key,
      detail: `${topTopic.count} mistakes in this topic`,
      icon: <Target size={20} />
    },
    {
      label: "待完成任务",
      value: String(openTasks),
      detail: "todo / in progress / failed today",
      icon: <CircleAlert size={20} />
    }
  ];
}

function buildProblemSummaries(data: DashboardData): ProblemSummary[] {
  const attemptsByProblemId = groupBy(data.attempts, (attempt) => attempt.problemId);
  const mistakesByProblemId = groupBy(data.mistakes, (mistake) => mistake.problemId);
  const reviewLogsByProblemId = groupBy(data.reviewLogs, (reviewLog) => reviewLog.problemId);
  const reviewStateByProblemId = new Map(
    data.reviewStates.map((reviewState) => [reviewState.problemId, reviewState])
  );

  return data.problems
    .map((problem) => {
      const attempts = (attemptsByProblemId.get(problem.id) ?? []).sort(sortBySubmittedAtDesc);
      const mistakes = (mistakesByProblemId.get(problem.id) ?? []).sort(sortByCreatedAtDesc);
      const reviewLogs = (reviewLogsByProblemId.get(problem.id) ?? []).sort(sortByReviewedAtDesc);
      const latestAttempt = attempts[0];
      const latestMistake = mistakes[0];

      return {
        problem,
        attempts,
        mistakes,
        reviewLogs,
        reviewState: reviewStateByProblemId.get(problem.id),
        failureCount: attempts.filter((attempt) => attempt.result !== "Accepted").length,
        latestAttempt,
        latestMistake,
        primaryReason: getPrimaryReason(mistakes),
        primaryTopic: getPrimaryTopic(problem),
        lastFailedAt: latestAttempt?.submittedAt ?? problem.lastSeenAt
      };
    })
    .filter((item) => item.failureCount > 0);
}

function getPrimaryReason(mistakes: MistakeRecord[]): string {
  const counts = new Map<string, number>();

  for (const mistake of mistakes) {
    counts.set(mistake.primaryReason, (counts.get(mistake.primaryReason) ?? 0) + 1);
  }

  return getHighestCountKey(counts, "Uncategorized");
}

function getPrimaryTopic(problem: Problem): string {
  return problem.tags[0] ?? "Unknown";
}

function sortNotebookRows(a: ProblemSummary, b: ProblemSummary, sortBy: NotebookSort): number {
  if (sortBy === "frequency") {
    return b.failureCount - a.failureCount || b.lastFailedAt.localeCompare(a.lastFailedAt);
  }

  if (sortBy === "topic") {
    return a.primaryTopic.localeCompare(b.primaryTopic) || b.lastFailedAt.localeCompare(a.lastFailedAt);
  }

  if (sortBy === "reason") {
    return a.primaryReason.localeCompare(b.primaryReason) || b.lastFailedAt.localeCompare(a.lastFailedAt);
  }

  return b.lastFailedAt.localeCompare(a.lastFailedAt);
}

function sortTaskRows(a: TaskRow, b: TaskRow): number {
  return getTaskStatusPriority(a.task.status) - getTaskStatusPriority(b.task.status);
}

function getTaskStatusPriority(status: ReviewTask["status"]): number {
  const priority: Record<ReviewTask["status"], number> = {
    todo: 1,
    in_progress: 2,
    failed_today: 3,
    skipped: 4,
    done: 5
  };

  return priority[status];
}

function getPlanDates(tasks: ReviewTask[], planId?: string): string[] {
  const generatedDates = [0, 1, 2, 3].map((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return toDateKey(date);
  });
  const taskDates = tasks
    .filter((task) => task.planId === planId)
    .map((task) => toDateKey(new Date(task.scheduledFor)));

  return Array.from(new Set([...generatedDates, ...taskDates])).sort();
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return groups;
}

function getHighestCountKey(counts: Map<string, number>, fallback: string): string {
  return getHighestCountEntry(counts, fallback).key;
}

function getHighestCountEntry(counts: Map<string, number>, fallback: string): {
  key: string;
  count: number;
} {
  let winner = fallback;
  let highestCount = 0;

  for (const [key, count] of counts) {
    if (count > highestCount) {
      winner = key;
      highestCount = count;
    }
  }

  return { key: winner, count: highestCount };
}

function sortBySubmittedAtDesc(a: SubmissionAttempt, b: SubmissionAttempt): number {
  return b.submittedAt.localeCompare(a.submittedAt);
}

function sortByCreatedAtDesc(a: MistakeRecord, b: MistakeRecord): number {
  return b.createdAt.localeCompare(a.createdAt);
}

function sortByReviewedAtDesc(a: ReviewLog, b: ReviewLog): number {
  return b.reviewedAt.localeCompare(a.reviewedAt);
}

function formatReviewStatus(reviewState?: ReviewState): string {
  if (!reviewState) {
    return "scheduled";
  }

  if (reviewState.status === "to_review" || reviewState.status === "reviewing") {
    return "scheduled";
  }

  return reviewState.status;
}

function formatReviewLogResult(result: ReviewLog["result"]): string {
  return result
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function getSecondaryReasonOptions(primaryReason: string): string[] {
  return mistakeTaxonomy.find((item) => item.primaryReason === primaryReason)?.secondaryReasons ?? [];
}

function formatTaskStatus(status: ReviewTask["status"]): string {
  return status
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "Not scheduled";
  }

  return new Date(value).toLocaleString();
}

function formatDate(value?: string): string {
  if (!value) {
    return "Not scheduled";
  }

  return new Date(value).toLocaleDateString();
}

function formatDateTab(dateKey: string): string {
  const today = toDateKey(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = toDateKey(tomorrowDate);

  if (dateKey === today) {
    return "Today";
  }

  if (dateKey === tomorrow) {
    return "Tomorrow";
  }

  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyToIso(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toISOString();
}

function getRouteFromHash(): Route {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const problemId = params.get("problem");

  return problemId ? { name: "detail", problemId } : { name: "dashboard" };
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>
);
