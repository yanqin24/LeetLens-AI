# LeetLens MVP 开发问题与修复记录

## 1. 文档目标

本文档用于记录 LeetLens MVP 开发过程中遇到的关键问题、根因分析、修复方案和验证方式。

这些记录后续可以用于：

- 项目复盘
- 面试讲解
- 简历项目细节补充
- 后续重构时理解历史决策

## 2. 问题记录模板

每个问题按照以下结构记录：

- 问题现象
- 影响范围
- 修改前代码和逻辑
- 根因分析
- 修改后代码和逻辑
- 涉及文件
- 验证方式
- 面试可讲点

## 3. Bug：保存错因后同一次提交重复弹窗

### 问题现象

用户在 LeetCode `Submit` 失败后，LeetLens 会弹出错因选择面板。用户选择原因并保存后，页面停留在当前 LeetCode 结果页，过一会儿插件又会弹出新的错因选择面板，要求用户再次记录同一次失败。

用户期望：

```text
一次 Submit 失败
↓
最多弹一次错因面板
↓
Save / Close / Cancel 后，这次 Submit 就结束
↓
只有下一次 Submit 失败才重新弹
```

### 影响范围

- 用户体验被打断
- 同一次失败可能被重复记录
- Dashboard 中可能出现重复 attempt / mistake
- 用户保存的错因流程不符合“case closed”的直觉

### 修改前代码和逻辑

修改前，`content script` 主要通过 `MutationObserver` 监听整个 LeetCode 页面：

```ts
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
```

提交后会打开一个较长的观察窗口：

```ts
const SUBMIT_CAPTURE_WINDOW_MS = 90_000;

function armSubmitCapture(): void {
  submitArmedUntil = Date.now() + SUBMIT_CAPTURE_WINDOW_MS;
}
```

在这个窗口内，只要页面还能检测到失败结果，就可能继续尝试捕捉：

```ts
if (!submitArmed) {
  lastResultSignature = failureState.signature;
  return;
}
```

保存错因时，只更新 `MistakeRecord`：

```ts
const response = await chrome.runtime.sendMessage({
  type: "UPDATE_MISTAKE_REASON",
  payload: {
    mistakeRecordId: input.mistakeRecordId,
    primaryReason,
    note
  }
}) as CaptureResponse;
```

修改前保存后没有明确执行：

```text
关闭当前 Submit 捕捉窗口
标记当前 Submit 已处理
关闭面板
阻止同一次 Submit 再次弹窗
```

### 根因分析

根因是提交后的观察窗口过长，并且“同一次 Submit 是否已经处理过”没有被建模。

LeetCode 是一个 SPA 页面，失败结果出来后页面仍可能继续发生 DOM 更新，例如：

- 错误结果区域重新渲染
- result panel 文本发生轻微变化
- 编辑器区域或提交区域继续更新
- 用户保存错因后，LeetLens 自己的面板状态变化也可能间接触发观察器

虽然代码中已有 fingerprint 去重，但当页面文本、代码提取结果或错误区域内容发生变化时，仍可能绕过去重判断。

更核心的问题是：产品语义上“一次 Submit”没有对应的状态机。

修改前的隐含状态是：

```text
Submit 后 90 秒内
↓
只要看到失败结果
↓
就可能记录
```

这会导致同一次 Submit 在观察窗口内被多次处理。

### 修改后代码和逻辑

修改后，引入了 submit sequence，用状态明确表达“一次 Submit 最多处理一次”。

核心变量：

```ts
const SUBMIT_CAPTURE_WINDOW_MS = 30_000;

let submitSequence = 0;
let handledSubmitSequence = 0;
let submitArmedUntil = 0;
```

每次新的 Submit 会生成新的序号：

```ts
function armSubmitCapture(): void {
  if (isSubmitCaptureArmed()) {
    return;
  }

  submitSequence += 1;
  submitArmedUntil = Date.now() + SUBMIT_CAPTURE_WINDOW_MS;
}
```

同一次 Submit 被处理后，会标记为 handled：

```ts
function markCurrentSubmitHandled(): void {
  handledSubmitSequence = submitSequence;
  disarmSubmitCapture();
}
```

捕捉前会检查当前 Submit 是否已经处理：

```ts
async function tryCaptureLatestFailure(): Promise<void> {
  if (captureInFlight || isCurrentSubmitHandled() || document.getElementById(PANEL_ROOT_ID)) {
    return;
  }

  ...
}
```

弹出错因面板后，立即将当前 Submit 标记为 handled：

```ts
showMistakePanel({
  problemTitle: problem.title,
  result,
  language,
  problemId: response.data.problemId,
  attemptId: response.data.attemptId,
  mistakeRecordId: response.data.mistakeRecordId
});

markCurrentSubmitHandled();
```

保存成功后关闭面板：

```ts
if (response.ok) {
  markCurrentSubmitHandled();
  window.setTimeout(() => root.remove(), 350);
}
```

新增 `Cancel` 按钮。用户点击 `Cancel` 或右上角 `X` 时，删除本次临时记录，并结束当前 Submit：

```ts
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
```

后台新增消息类型：

```ts
export type DiscardCapturedSubmissionMessage = {
  type: "DISCARD_CAPTURED_SUBMISSION";
  payload: {
    problemId: string;
    attemptId: string;
    mistakeRecordId: string;
  };
};
```

后台处理逻辑：

```ts
case "DISCARD_CAPTURED_SUBMISSION":
  return discardCapturedSubmission(message.payload);
```

数据层删除临时记录：

```ts
export async function discardCapturedSubmission(input: {
  problemId: string;
  attemptId: string;
  mistakeRecordId: string;
}): Promise<void> {
  await db.transaction(
    "rw",
    db.problems,
    db.attempts,
    db.mistakes,
    db.reviewStates,
    db.reviewLogs,
    async () => {
      await db.mistakes.delete(input.mistakeRecordId);
      await db.attempts.delete(input.attemptId);

      const [remainingAttempts, remainingMistakes, reviewLogs] = await Promise.all([
        db.attempts.where("problemId").equals(input.problemId).count(),
        db.mistakes.where("problemId").equals(input.problemId).count(),
        db.reviewLogs.where("problemId").equals(input.problemId).count()
      ]);

      if (remainingAttempts === 0 && remainingMistakes === 0 && reviewLogs === 0) {
        const reviewState = await db.reviewStates.where("problemId").equals(input.problemId).first();

        if (reviewState) {
          await db.reviewStates.delete(reviewState.id);
        }

        await db.problems.delete(input.problemId);
      }
    }
  );
}
```

### 修改后的产品行为

现在行为变为：

```text
Run 失败
↓
不弹，不记录

Submit 失败
↓
弹一次错因面板

用户 Save
↓
保存错因
↓
关闭面板
↓
当前 Submit 标记为 handled
↓
不再重复弹

用户 Cancel 或 X
↓
删除本次临时记录
↓
关闭面板
↓
当前 Submit 标记为 handled
↓
不再重复弹

用户再次 Submit 且失败
↓
生成新的 submitSequence
↓
重新弹出错因面板
```

### 涉及文件

- `src/content/leetcodeContentScript.ts`
- `src/shared/types/messages.ts`
- `src/background/serviceWorker.ts`
- `src/shared/db/repositories/captureRepository.ts`
- `public/contentScript.css`

### 验证方式

构建验证：

```bash
npm run build
```

手动验证：

```text
1. 打开 chrome://extensions
2. reload LeetLens
3. 刷新 LeetCode 题目页
4. 点击 Run，制造失败
5. 确认不弹错因面板
6. 点击 Submit，制造失败
7. 确认弹出一次错因面板
8. 点击 Save reason
9. 确认面板关闭，并且停留页面一段时间不再重复弹
10. 再次 Submit 失败
11. 确认重新弹出一次错因面板
12. 点击 Cancel 或 X
13. 确认本次临时记录不会出现在 Dashboard
```

### 面试可讲点

这个 bug 可以作为面试中的工程问题案例：

```text
I initially used a MutationObserver to detect failed submission results on LeetCode, but because LeetCode is a SPA and continues to update the DOM after the result appears, the extension could repeatedly process the same failed submission. I fixed this by modeling each Submit action as a stateful event with a submit sequence, ensuring each failed Submit can trigger at most one mistake panel. I also added explicit Save, Cancel, and Close semantics, where Cancel discards the temporary local records and Save closes the submission lifecycle.
```

重点可以强调：

- 第三方 SPA 页面观察不能只靠 DOM 文本变化
- 需要把用户动作建模为状态机
- 一次 Submit 应该对应一次 capture lifecycle
- Save / Cancel / Close 应该有明确的数据语义
- 使用 IndexedDB transaction 保证删除临时记录的一致性

## 4. Bug：Run 失败也触发错因面板

### 问题现象

用户点击 LeetCode 的 `Run` 后，如果代码运行失败，LeetLens 也会弹出错因选择面板。

这不符合 MVP PRD。第一版只应该记录正式 `Submit` 失败，不记录 `Run` 失败。

### 修改前代码和逻辑

早期逻辑主要依赖页面失败结果文本：

```text
页面出现 Wrong Answer / Runtime Error / Compile Error / TLE
↓
插件认为出现失败提交
↓
保存并弹窗
```

这个逻辑没有可靠区分：

```text
Run Code 失败
Submit 失败
```

### 根因分析

LeetCode 的 Run 和 Submit 都会在页面上渲染失败结果，例如：

- Wrong Answer
- Runtime Error
- Compile Error

如果只看页面结果文本，插件无法知道这个结果来自 Run 还是 Submit。

### 修改后代码和逻辑

新增页面网络桥接脚本：

```text
src/content/pageNetworkBridge.ts
```

它运行在页面主环境中，监听 LeetCode 的 `fetch` 和 `XMLHttpRequest`：

```ts
installFetchBridge();
installXhrBridge();
```

它只判断请求意图：

```ts
type LeetLensIntent = "run" | "submit";
```

Run 请求：

```ts
if (
  source.includes("/interpret_solution") ||
  source.includes("interpretsolution") ||
  source.includes("interpret_solution") ||
  source.includes("run_code") ||
  source.includes("runcode")
) {
  return "run";
}
```

Submit 请求：

```ts
if (
  source.includes("/submit/") ||
  source.includes("/submissions/") ||
  source.includes("submitsolution") ||
  source.includes("submit_solution") ||
  source.includes("submitsession")
) {
  return "submit";
}
```

然后通过 `window.postMessage` 把 intent 传给 content script：

```ts
window.postMessage(
  {
    type: MESSAGE_TYPE,
    intent,
    source,
    timestamp: Date.now()
  },
  window.location.origin
);
```

content script 接收到 intent：

```ts
if (data.intent === "submit") {
  armSubmitCapture();
  return;
}

disarmSubmitCapture();
rememberCurrentResultAsBaseline();
```

现在逻辑变为：

```text
Run API detected
↓
disarm
↓
不记录

Submit API detected
↓
arm
↓
等待失败结果
↓
记录并弹窗
```

### 涉及文件

- `src/content/pageNetworkBridge.ts`
- `src/content/leetcodeContentScript.ts`
- `public/manifest.json`
- `vite.config.ts`

### 验证方式

手动验证：

```text
1. reload 插件
2. 刷新 LeetCode 题目页
3. 点击 Run，制造失败
4. 确认不弹错因面板
5. 点击 Submit，制造失败
6. 确认弹出错因面板
```

构建验证：

```bash
npm run build
```

### 面试可讲点

这个 bug 可以这样讲：

```text
DOM-based detection could not distinguish Run Code failures from official Submit failures because both render similar result text on the LeetCode page. I added a page-context network bridge that observes fetch and XMLHttpRequest intent, classifies requests as Run or Submit based on API endpoints, and only arms capture after official Submit requests. This reduced false positives without requesting broader webRequest permissions.
```

重点可以强调：

- DOM text is not enough for intent detection
- Run and Submit should have different product semantics
- Network intent is a more reliable signal than button text
- The implementation avoids collecting request payloads or tokens
- The solution avoids broader Chrome permissions

