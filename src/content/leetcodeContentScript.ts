type SubmissionResult =
  | "Wrong Answer"
  | "Time Limit Exceeded"
  | "Runtime Error"
  | "Compile Error"
  | "Accepted";

type CaptureResponse = {
  ok: boolean;
  data?: {
    problemId: string;
    attemptId: string;
    mistakeRecordId: string;
    duplicate: boolean;
  };
  error?: string;
};

const FAILED_RESULTS: SubmissionResult[] = [
  "Wrong Answer",
  "Time Limit Exceeded",
  "Runtime Error",
  "Compile Error"
];
const NETWORK_INTENT_MESSAGE = "__LEETLENS_NETWORK_INTENT__";
const PANEL_ROOT_ID = "leetlens-root";
const FINGERPRINT_DEDUPE_WINDOW_MS = 10 * 60_000;
const SUBMIT_CAPTURE_WINDOW_MS = 30_000;

let lastFingerprint = "";
let lastFingerprintAt = 0;
let submitArmedUntil = 0;
let submitSequence = 0;
let handledSubmitSequence = 0;
let lastResultSignature = "";
let captureInFlight = false;
const recentFingerprints = new Map<string, number>();

main();

function main(): void {
  if (!isProblemPage()) {
    return;
  }

  observeSubmissionResults();
  observeSubmitClicks();
  observeNetworkIntents();
  rememberCurrentResultAsBaseline();
}

function observeSubmissionResults(): void {
  const observer = new MutationObserver((mutations) => {
    if (mutations.every(isLeetLensMutation)) {
      return;
    }

    void tryCaptureLatestFailure();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

function rememberCurrentResultAsBaseline(): void {
  window.setTimeout(() => {
    const currentFailure = detectFailureState();
    lastResultSignature = currentFailure?.signature ?? "";
  }, 500);
}

function observeNetworkIntents(): void {
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    const data = event.data;

    if (!isNetworkIntentMessage(data)) {
      return;
    }

    if (data.intent === "submit") {
      armSubmitCapture();
      return;
    }

    disarmSubmitCapture();
    rememberCurrentResultAsBaseline();
  });
}

function isNetworkIntentMessage(value: unknown): value is {
  type: typeof NETWORK_INTENT_MESSAGE;
  intent: "run" | "submit";
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeMessage = value as { type?: unknown; intent?: unknown };

  return (
    maybeMessage.type === NETWORK_INTENT_MESSAGE &&
    (maybeMessage.intent === "run" || maybeMessage.intent === "submit")
  );
}

function observeSubmitClicks(): void {
  const armIfSubmitIntent = (event: Event): void => {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    if (isSubmitTrigger(target)) {
      armSubmitCapture();
    }
  };

  document.addEventListener("pointerdown", armIfSubmitIntent, true);
  document.addEventListener("click", armIfSubmitIntent, true);
  document.addEventListener(
    "keydown",
    (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        armSubmitCapture();
      }
    },
    true
  );
}

function isSubmitTrigger(target: Element): boolean {
  const clickable = target.closest(
    "button, [role='button'], [data-e2e-locator], [data-cy], a"
  );

  if (!clickable || clickable.closest(`#${PANEL_ROOT_ID}`)) {
    return false;
  }

  const text = normalizeText(clickable.textContent ?? "");
  const ariaLabel = normalizeText(clickable.getAttribute("aria-label") ?? "");
  const dataCy = normalizeText(clickable.getAttribute("data-cy") ?? "");
  const dataLocator = normalizeText(clickable.getAttribute("data-e2e-locator") ?? "");
  const combined = `${text} ${ariaLabel} ${dataCy} ${dataLocator}`;

  if (combined.includes("submissions") || /\brun\b/.test(combined) || combined.includes("运行")) {
    return false;
  }

  return (
    /\bsubmit\b/.test(combined) ||
    /\bsubmit code\b/.test(combined) ||
    combined.includes("提交")
  );
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function armSubmitCapture(): void {
  if (isSubmitCaptureArmed()) {
    return;
  }

  submitSequence += 1;
  submitArmedUntil = Date.now() + SUBMIT_CAPTURE_WINDOW_MS;
}

function disarmSubmitCapture(): void {
  submitArmedUntil = 0;
}

function isSubmitCaptureArmed(): boolean {
  return submitArmedUntil > 0 && Date.now() <= submitArmedUntil;
}

function markCurrentSubmitHandled(): void {
  handledSubmitSequence = submitSequence;
  disarmSubmitCapture();
}

function isCurrentSubmitHandled(): boolean {
  return submitSequence > 0 && submitSequence === handledSubmitSequence;
}

async function tryCaptureLatestFailure(): Promise<void> {
  if (captureInFlight || isCurrentSubmitHandled() || document.getElementById(PANEL_ROOT_ID)) {
    return;
  }

  const failureState = detectFailureState();

  if (!failureState) {
    return;
  }

  const submitArmed = isSubmitCaptureArmed();

  if (!submitArmed) {
    lastResultSignature = failureState.signature;
    return;
  }

  lastResultSignature = failureState.signature;

  const result = failureState.result;
  const problem = extractProblemMetadata();
  const language = extractLanguage();
  const codeResult = extractCode();
  const errorMessage = failureState.errorMessage;
  const fingerprint = await createAttemptFingerprint({
    problemSlug: problem.slug,
    result,
    language,
    code: codeResult.code,
    errorMessage
  });

  if (isDuplicateFingerprint(fingerprint)) {
    markCurrentSubmitHandled();
    return;
  }

  captureInFlight = true;

  try {
    const response = await chrome.runtime.sendMessage({
      type: "CAPTURE_FAILED_SUBMISSION",
      payload: {
        problem,
        attempt: {
          language,
          code: codeResult.code,
          result,
          errorMessage,
          codeCaptureStatus: codeResult.status,
          fingerprint
        }
      }
    }) as CaptureResponse;

    if (!response.ok || response.data?.duplicate || !response.data?.mistakeRecordId) {
      markCurrentSubmitHandled();
      return;
    }

    showMistakePanel({
      problemTitle: problem.title,
      result,
      language,
      problemId: response.data.problemId,
      attemptId: response.data.attemptId,
      mistakeRecordId: response.data.mistakeRecordId
    });
    markCurrentSubmitHandled();
  } finally {
    captureInFlight = false;
  }
}

function isProblemPage(): boolean {
  return location.hostname === "leetcode.com" && location.pathname.startsWith("/problems/");
}

function detectSubmissionResult(): SubmissionResult | undefined {
  const pageText = document.body.innerText;
  return FAILED_RESULTS.find((result) => pageText.includes(result));
}

function detectFailureState():
  | {
      result: Exclude<SubmissionResult, "Accepted">;
      errorMessage: string;
      signature: string;
    }
  | undefined {
  const result = detectSubmissionResult();

  if (!result || result === "Accepted") {
    return undefined;
  }

  const errorMessage = extractErrorMessage(result);

  return {
    result,
    errorMessage,
    signature: `${result}|${errorMessage}`
  };
}

function extractProblemMetadata() {
  const slug = location.pathname.split("/").filter(Boolean)[1] ?? "unknown";
  const rawTitle =
    queryText('[data-cy="question-title"]') ??
    queryText("a[href*='/problems/']") ??
    queryText("h1") ??
    slug;
  const titleMatch = rawTitle.match(/^(\d+)\.\s*(.*)$/);
  const leetcodeId = titleMatch?.[1];
  const title = titleMatch?.[2] ?? rawTitle;
  const difficulty = detectDifficulty();

  return {
    leetcodeId,
    title,
    slug,
    url: location.href,
    difficulty,
    tags: extractTags()
  };
}

function detectDifficulty(): "Easy" | "Medium" | "Hard" | "Unknown" {
  const pageText = document.body.innerText;

  if (pageText.includes("Easy")) {
    return "Easy";
  }

  if (pageText.includes("Medium")) {
    return "Medium";
  }

  if (pageText.includes("Hard")) {
    return "Hard";
  }

  return "Unknown";
}

function extractTags(): string[] {
  return Array.from(document.querySelectorAll("a[href*='/tag/']"))
    .map((element) => element.textContent?.trim())
    .filter((tag): tag is string => Boolean(tag))
    .slice(0, 12);
}

function extractLanguage(): string {
  const candidates = Array.from(document.querySelectorAll("button, div, span"))
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean);

  return (
    candidates.find((text) =>
      /^(C\+\+|Java|Python3?|JavaScript|TypeScript|C#|Go|Ruby|Swift|Kotlin|Rust|PHP|Scala|Dart|Elixir|Erlang|Racket|MySQL|MS SQL Server|Oracle|Pandas)$/i.test(
        text
      )
    ) ?? "Unknown"
  );
}

function extractCode(): { code: string; status: "success" | "partial" | "failed" } {
  const visibleCode = Array.from(document.querySelectorAll(".view-line"))
    .map((line) => line.textContent ?? "")
    .join("\n")
    .trim();

  if (visibleCode) {
    return { code: visibleCode, status: "partial" };
  }

  const textareas = Array.from(document.querySelectorAll("textarea"));
  const textareaValue = textareas.map((textarea) => textarea.value).find(Boolean);

  if (textareaValue) {
    return { code: textareaValue, status: "success" };
  }

  return { code: "", status: "failed" };
}

function extractErrorMessage(result: SubmissionResult): string {
  const pageText = document.body.innerText;
  const resultIndex = pageText.indexOf(result);

  if (resultIndex === -1) {
    return "";
  }

  return pageText.slice(resultIndex, resultIndex + 1200).trim();
}

function queryText(selector: string): string | undefined {
  return document.querySelector(selector)?.textContent?.trim() || undefined;
}

function isDuplicateFingerprint(fingerprint: string): boolean {
  const now = Date.now();
  cleanupRecentFingerprints(now);

  if (
    recentFingerprints.has(fingerprint) ||
    (fingerprint === lastFingerprint && now - lastFingerprintAt < FINGERPRINT_DEDUPE_WINDOW_MS)
  ) {
    return true;
  }

  lastFingerprint = fingerprint;
  lastFingerprintAt = now;
  recentFingerprints.set(fingerprint, now);
  return false;
}

function cleanupRecentFingerprints(now: number): void {
  for (const [fingerprint, timestamp] of recentFingerprints) {
    if (now - timestamp > FINGERPRINT_DEDUPE_WINDOW_MS) {
      recentFingerprints.delete(fingerprint);
    }
  }
}

async function createFingerprint(parts: string[]): Promise<string> {
  const source = parts.join("|");
  const data = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createAttemptFingerprint(input: {
  problemSlug: string;
  result: SubmissionResult;
  language: string;
  code: string;
  errorMessage: string;
}): Promise<string> {
  const codeOrFallback = input.code.trim() || input.errorMessage.slice(0, 300);

  return createFingerprint([
    input.problemSlug,
    input.result,
    input.language,
    codeOrFallback
  ]);
}

function showMistakePanel(input: {
  problemTitle: string;
  result: SubmissionResult;
  language: string;
  problemId: string;
  attemptId: string;
  mistakeRecordId: string;
}): void {
  if (document.getElementById(PANEL_ROOT_ID)) {
    return;
  }

  const root = document.createElement("div");
  root.id = PANEL_ROOT_ID;
  root.innerHTML = `
    <section class="leetlens-panel">
      <div class="leetlens-panel__header">
        <strong>LeetLens recorded this mistake</strong>
        <button class="leetlens-panel__close" type="button" aria-label="Close">x</button>
      </div>
      <p class="leetlens-panel__meta">${escapeHtml(input.problemTitle)} · ${input.result} · ${escapeHtml(input.language)}</p>
      <label class="leetlens-panel__label">
        Mistake reason
        <select class="leetlens-panel__select">
          <option value="Uncategorized">Uncategorized</option>
          <option value="Syntax / API Error">Syntax / API Error</option>
          <option value="Problem Understanding Error">Problem Understanding Error</option>
          <option value="Algorithmic Approach Error">Algorithmic Approach Error</option>
          <option value="Missing Edge Case">Missing Edge Case</option>
          <option value="Implementation Detail Error">Implementation Detail Error</option>
          <option value="Complexity Issue">Complexity Issue</option>
          <option value="Debugging Habit Issue">Debugging Habit Issue</option>
        </select>
      </label>
      <label class="leetlens-panel__label">
        Quick note
        <textarea class="leetlens-panel__note" rows="3" placeholder="What should you remember next time?"></textarea>
      </label>
      <div class="leetlens-panel__actions">
        <button class="leetlens-panel__save" type="button">Save reason</button>
        <button class="leetlens-panel__cancel" type="button">Cancel</button>
        <span class="leetlens-panel__status"></span>
      </div>
    </section>
  `;

  document.body.append(root);

  root.querySelector(".leetlens-panel__close")?.addEventListener("click", () => {
    void discardPanelCapture(root, input);
  });
  root.querySelector(".leetlens-panel__cancel")?.addEventListener("click", () => {
    void discardPanelCapture(root, input);
  });
  root.querySelector(".leetlens-panel__save")?.addEventListener("click", async () => {
    const primaryReason = (root.querySelector(".leetlens-panel__select") as HTMLSelectElement).value;
    const note = (root.querySelector(".leetlens-panel__note") as HTMLTextAreaElement).value;
    const status = root.querySelector(".leetlens-panel__status");

    const response = await chrome.runtime.sendMessage({
      type: "UPDATE_MISTAKE_REASON",
      payload: {
        mistakeRecordId: input.mistakeRecordId,
        primaryReason,
        note
      }
    }) as CaptureResponse;

    if (status) {
      status.textContent = response.ok ? "Saved" : "Save failed";
    }

    if (response.ok) {
      markCurrentSubmitHandled();
      window.setTimeout(() => root.remove(), 350);
    }
  });
}

async function discardPanelCapture(
  root: HTMLElement,
  input: {
    problemId: string;
    attemptId: string;
    mistakeRecordId: string;
  }
): Promise<void> {
  markCurrentSubmitHandled();

  await chrome.runtime.sendMessage({
    type: "DISCARD_CAPTURED_SUBMISSION",
    payload: {
      problemId: input.problemId,
      attemptId: input.attemptId,
      mistakeRecordId: input.mistakeRecordId
    }
  });

  root.remove();
}

function isLeetLensMutation(mutation: MutationRecord): boolean {
  return isInsideLeetLensRoot(mutation.target);
}

function isInsideLeetLensRoot(target: Node): boolean {
  if (!(target instanceof Element)) {
    return Boolean(target.parentElement?.closest(`#${PANEL_ROOT_ID}`));
  }

  return Boolean(target.closest(`#${PANEL_ROOT_ID}`));
}

function escapeHtml(value: string): string {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}
