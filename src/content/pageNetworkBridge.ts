type LeetLensIntent = "run" | "submit";
type SubmissionResult =
  | "Wrong Answer"
  | "Time Limit Exceeded"
  | "Runtime Error"
  | "Compile Error"
  | "Accepted";

const MESSAGE_TYPE = "__LEETLENS_NETWORK_INTENT__";
const RESULT_MESSAGE_TYPE = "__LEETLENS_SUBMISSION_RESULT__";
const SUBMISSION_RESULTS: SubmissionResult[] = [
  "Wrong Answer",
  "Time Limit Exceeded",
  "Runtime Error",
  "Compile Error",
  "Accepted"
];

installFetchBridge();
installXhrBridge();

function installFetchBridge(): void {
  const originalFetch = window.fetch;

  window.fetch = function leetLensFetch(input: RequestInfo | URL, init?: RequestInit) {
    const intent = detectIntentFromRequest(input, init?.body);
    const url = getRequestUrl(input);

    if (intent) {
      postIntent(intent, "fetch");
    }

    const responsePromise = originalFetch.apply(this, [input, init]);

    void responsePromise
      .then((response) => {
        if (canContainSubmissionResult(url)) {
          void inspectFetchResponse(response);
        }
      })
      .catch(() => undefined);

    return responsePromise;
  };
}

function installXhrBridge(): void {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function leetLensOpen(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    const xhr = this as XMLHttpRequest & { __leetLensUrl?: string };
    xhr.__leetLensUrl = String(url);
    return originalOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
  };

  XMLHttpRequest.prototype.send = function leetLensSend(body?: Document | XMLHttpRequestBodyInit | null) {
    const xhr = this as XMLHttpRequest & { __leetLensUrl?: string };
    const url = String(xhr.__leetLensUrl ?? "");
    const intent = detectIntent(url, serializeBody(body));

    if (intent) {
      postIntent(intent, "xhr");
    }

    if (canContainSubmissionResult(url)) {
      xhr.addEventListener("loadend", () => inspectXhrResponse(xhr));
    }

    return originalSend.call(this, body);
  };
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (input instanceof Request) {
    return input.url;
  }

  return String(input);
}

function detectIntentFromRequest(input: RequestInfo | URL, body?: BodyInit | null): LeetLensIntent | undefined {
  if (input instanceof Request) {
    return detectIntent(input.url, serializeBody(body));
  }

  return detectIntent(String(input), serializeBody(body));
}

function detectIntent(url: string, bodyText: string): LeetLensIntent | undefined {
  const source = `${url} ${bodyText}`.toLowerCase();

  if (
    source.includes("/interpret_solution") ||
    source.includes("interpretsolution") ||
    source.includes("interpret_solution") ||
    source.includes("run_code") ||
    source.includes("runcode")
  ) {
    return "run";
  }

  if (
    source.includes("/submit/") ||
    source.includes("submitsolution") ||
    source.includes("submit_solution") ||
    source.includes("submitsession")
  ) {
    return "submit";
  }

  return undefined;
}

function canContainSubmissionResult(url: string): boolean {
  const normalizedUrl = url.toLowerCase();

  return (
    normalizedUrl.includes("/submissions/detail/") ||
    normalizedUrl.includes("submissiondetail") ||
    normalizedUrl.includes("submission_detail")
  );
}

async function inspectFetchResponse(response: Response): Promise<void> {
  try {
    inspectResponseText(await response.clone().text());
  } catch {
    // Ignore opaque or unreadable responses.
  }
}

function inspectXhrResponse(xhr: XMLHttpRequest): void {
  try {
    if (typeof xhr.responseText === "string") {
      inspectResponseText(xhr.responseText);
    }
  } catch {
    // Some response types do not expose responseText.
  }
}

function inspectResponseText(text: string): void {
  const result = parseSubmissionResult(text);

  if (!result) {
    return;
  }

  postSubmissionResult(result.result, result.errorMessage);
}

function parseSubmissionResult(text: string): { result: SubmissionResult; errorMessage: string } | undefined {
  const payload = parseJson(text);
  const source = payload ? collectStringValues(payload).join("\n") : text;
  const result = SUBMISSION_RESULTS.find((candidate) => source.includes(candidate));

  if (!result) {
    return undefined;
  }

  return {
    result,
    errorMessage: extractErrorMessageFromSource(source, result)
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function collectStringValues(value: unknown, depth = 0): string[] {
  if (depth > 6 || value == null) {
    return [];
  }

  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringValues(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      collectStringValues(item, depth + 1)
    );
  }

  return [];
}

function extractErrorMessageFromSource(source: string, result: SubmissionResult): string {
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const focusedLine = lines.find(
    (line) =>
      line.includes(result) ||
      line.includes("Error") ||
      line.includes("Exception") ||
      line.includes("Line ")
  );

  return focusedLine ?? result;
}

function serializeBody(body: BodyInit | Document | XMLHttpRequestBodyInit | null | undefined): string {
  if (!body) {
    return "";
  }

  if (typeof body === "string") {
    return body.slice(0, 1000);
  }

  if (body instanceof URLSearchParams) {
    return body.toString().slice(0, 1000);
  }

  return "";
}

function postIntent(intent: LeetLensIntent, source: "fetch" | "xhr"): void {
  window.postMessage(
    {
      type: MESSAGE_TYPE,
      intent,
      source,
      timestamp: Date.now()
    },
    window.location.origin
  );
}

function postSubmissionResult(result: SubmissionResult, errorMessage: string): void {
  window.postMessage(
    {
      type: RESULT_MESSAGE_TYPE,
      result,
      errorMessage,
      timestamp: Date.now()
    },
    window.location.origin
  );
}

export {};
