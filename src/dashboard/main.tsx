import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { db } from "../shared/db/schema";
import { getDashboardSummary, type DashboardSummary } from "../shared/db/repositories/dashboardRepository";
import type { MistakeRecord } from "../shared/types/mistake";
import type { Problem } from "../shared/types/problem";
import "./dashboard.css";

type MistakeRow = {
  mistake: MistakeRecord;
  problem?: Problem;
};

function DashboardApp(): JSX.Element {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [rows, setRows] = useState<MistakeRow[]>([]);
  const [reasonFilter, setReasonFilter] = useState("All");

  useEffect(() => {
    void loadDashboard();
  }, []);

  const filteredRows = useMemo(() => {
    if (reasonFilter === "All") {
      return rows;
    }

    return rows.filter((row) => row.mistake.primaryReason === reasonFilter);
  }, [reasonFilter, rows]);

  const reasons = useMemo(() => {
    return ["All", ...Array.from(new Set(rows.map((row) => row.mistake.primaryReason)))];
  }, [rows]);

  async function loadDashboard(): Promise<void> {
    const [nextSummary, mistakes, problems] = await Promise.all([
      getDashboardSummary(),
      db.mistakes.orderBy("createdAt").reverse().toArray(),
      db.problems.toArray()
    ]);
    const problemById = new Map(problems.map((problem) => [problem.id, problem]));

    setSummary(nextSummary);
    setRows(mistakes.map((mistake) => ({ mistake, problem: problemById.get(mistake.problemId) })));
  }

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">LeetLens MVP</p>
          <h1>Dashboard</h1>
        </div>
        <button className="dashboard__ghostButton" type="button" onClick={() => void loadDashboard()}>
          Refresh
        </button>
      </header>

      <section className="dashboard__stats" aria-label="Dashboard stats">
        <Stat label="Due today" value={summary?.dueTodayCount ?? 0} />
        <Stat label="New this week" value={summary?.newMistakesThisWeekCount ?? 0} />
        <Stat label="Total mistakes" value={summary?.totalMistakes ?? 0} />
        <Stat label="Weakest tag" value={summary?.weakestTag ?? "None"} />
      </section>

      <section className="dashboard__toolbar">
        <label>
          Mistake reason
          <select value={reasonFilter} onChange={(event) => setReasonFilter(event.target.value)}>
            {reasons.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="dashboard__list" aria-label="Mistake records">
        {filteredRows.length ? (
          filteredRows.map((row) => <MistakeCard key={row.mistake.id} row={row} />)
        ) : (
          <div className="dashboard__empty">
            <h2>No mistakes yet</h2>
            <p>Failed LeetCode submissions will appear here after the content script captures them.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="dashboard__stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MistakeCard({ row }: { row: MistakeRow }): JSX.Element {
  const problem = row.problem;

  return (
    <article className="dashboard__card">
      <div>
        <p className="dashboard__meta">
          {problem?.difficulty ?? "Unknown"} · {new Date(row.mistake.createdAt).toLocaleString()}
        </p>
        <h2>{problem?.title ?? "Unknown problem"}</h2>
        <p className="dashboard__reason">{row.mistake.primaryReason}</p>
        {row.mistake.note ? <p className="dashboard__note">{row.mistake.note}</p> : null}
      </div>
      {problem?.url ? (
        <a className="dashboard__link" href={problem.url} target="_blank" rel="noreferrer">
          Open
        </a>
      ) : null}
    </article>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>
);
