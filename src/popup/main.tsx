import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { DashboardSummary } from "../shared/db/repositories/dashboardRepository";
import "./popup.css";

function PopupApp(): JSX.Element {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: "GET_DASHBOARD_SUMMARY" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(response.error);
        }

        setSummary(response.data);
      })
      .catch((error: unknown) => {
        setError(error instanceof Error ? error.message : "Failed to load summary");
      });
  }, []);

  return (
    <main className="popup">
      <header className="popup__header">
        <div>
          <p className="popup__eyebrow">LeetLens</p>
          <h1>Mistake Review</h1>
        </div>
      </header>

      {error ? <p className="popup__error">{error}</p> : null}

      <section className="popup__stats" aria-label="Mistake summary">
        <Stat label="Due today" value={summary?.dueTodayCount ?? 0} />
        <Stat label="This week" value={summary?.newMistakesThisWeekCount ?? 0} />
      </section>

      <section className="popup__panel">
        <p className="popup__label">Most frequent reason</p>
        <strong>{summary?.mostFrequentReason ?? "None"}</strong>
      </section>

      <button className="popup__button" type="button" onClick={openDashboard}>
        Open Dashboard
      </button>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="popup__stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function openDashboard(): void {
  window.open(chrome.runtime.getURL("dashboard.html"), "_blank", "noopener,noreferrer");
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);
