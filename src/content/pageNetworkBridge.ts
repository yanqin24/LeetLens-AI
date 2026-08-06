type LeetLensIntent = "run" | "submit";

const MESSAGE_TYPE = "__LEETLENS_NETWORK_INTENT__";

installFetchBridge();
installXhrBridge();

function installFetchBridge(): void {
  const originalFetch = window.fetch;

  window.fetch = function leetLensFetch(input: RequestInfo | URL, init?: RequestInit) {
    const intent = detectIntentFromRequest(input, init?.body);

    if (intent) {
      postIntent(intent, "fetch");
    }

    return originalFetch.apply(this, [input, init]);
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
    const intent = detectIntent(String(xhr.__leetLensUrl ?? ""), serializeBody(body));

    if (intent) {
      postIntent(intent, "xhr");
    }

    return originalSend.call(this, body);
  };
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
    source.includes("/submissions/") ||
    source.includes("submitsolution") ||
    source.includes("submit_solution") ||
    source.includes("submitsession")
  ) {
    return "submit";
  }

  return undefined;
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
