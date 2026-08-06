# LeetLens Chrome 插件 MVP 技术设计文档

## 1. 文档目标

本文档定义 LeetLens MVP 的技术架构、模块边界、数据流、存储设计、消息通信机制和关键实现策略。

本技术设计服务于第一版 MVP：

```text
失败提交 -> 自动记录 -> 用户确认错因 -> 本地错题本 -> 定期复习
```

## 2. 技术栈

推荐技术栈：

```text
TypeScript
React
Vite
Chrome Extension Manifest V3
IndexedDB
Dexie.js
chrome.storage.local
```

选择理由：

- TypeScript：统一插件、前端 UI、数据模型和后期后端的类型系统
- React：适合构建 popup、dashboard、题目详情页和错因确认 UI
- Vite：开发体验好，适合构建现代前端和 Chrome 插件页面
- Manifest V3：当前 Chrome 插件标准，后台逻辑使用 service worker
- IndexedDB + Dexie.js：适合本地结构化数据、索引查询和离线使用
- chrome.storage.local：适合保存轻量用户设置

## 3. 系统架构

MVP 包含 5 个主要部分：

```text
LeetCode Page
  ↓
Content Script
  ↓
Background Service Worker
  ↓
Local Data Layer
  ↓
Popup / Dashboard / Problem Detail
```

模块说明：

- Content Script：注入 LeetCode 页面，负责检测提交结果、读取页面信息、展示页面内浮层
- Background Service Worker：负责消息路由、统一调用数据层、处理插件生命周期事件
- Local Data Layer：封装 IndexedDB / Dexie 操作
- Popup：浏览器插件入口，展示简要统计和快捷入口
- Dashboard：完整错题管理页面
- Problem Detail：单题复盘页面

## 4. Chrome 插件结构

建议目录结构：

```text
src/
  background/
    serviceWorker.ts
  content/
    leetcodeContentScript.ts
    detectors/
      submissionDetector.ts
      problemMetadataExtractor.ts
      codeExtractor.ts
    ui/
      InPageMistakePanel.tsx
  popup/
    PopupApp.tsx
  dashboard/
    DashboardApp.tsx
    pages/
      MistakeListPage.tsx
      ProblemDetailPage.tsx
      SettingsPage.tsx
  shared/
    db/
      index.ts
      schema.ts
      repositories/
        problemRepository.ts
        attemptRepository.ts
        mistakeRepository.ts
        reviewRepository.ts
    types/
      problem.ts
      attempt.ts
      mistake.ts
      review.ts
      messages.ts
    constants/
      mistakeTaxonomy.ts
      reviewPolicy.ts
    utils/
      date.ts
      ids.ts
```

说明：

- `content/` 只处理 LeetCode 页面相关逻辑
- `background/` 处理插件级消息和事件
- `shared/db/` 封装所有数据访问，避免 UI 直接操作 IndexedDB
- `shared/types/` 定义跨模块共享类型
- `dashboard/` 是完整管理界面
- `popup/` 是轻量入口

## 5. Manifest V3 设计

MVP 需要的关键 manifest 配置：

```json
{
  "manifest_version": 3,
  "name": "LeetLens",
  "version": "0.1.0",
  "action": {
    "default_popup": "popup.html"
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://leetcode.com/problems/*"],
      "js": ["contentScript.js"],
      "css": ["contentScript.css"],
      "run_at": "document_idle"
    }
  ],
  "permissions": ["storage"],
  "host_permissions": ["https://leetcode.com/*"]
}
```

MVP 暂时不需要：

- `tabs`
- `scripting`
- `identity`
- 远程代码执行
- 宽泛 host permissions

权限原则：

- 只申请 MVP 必要权限
- 只匹配 `leetcode.com/problems/*`
- 默认本地存储，不上传用户代码

## 6. 数据流设计

### 6.1 失败提交自动记录

```text
User clicks Submit
↓
LeetCode renders result
↓
Content Script detects failed result
↓
Content Script extracts:
  - problem metadata
  - language
  - current code
  - result type
  - error message
  - failed test case if visible
↓
Content Script sends CAPTURE_FAILED_SUBMISSION
↓
Background Service Worker receives message
↓
Data Layer upserts Problem
↓
Data Layer inserts SubmissionAttempt
↓
Data Layer creates uncategorized MistakeRecord
↓
Data Layer creates or updates ReviewState
↓
Background returns saved record id
↓
Content Script shows In-Page Mistake Panel
```

### 6.2 用户确认错因

```text
User selects primary reason / secondary reason / note
↓
Content Script sends UPDATE_MISTAKE_REASON
↓
Background updates MistakeRecord
↓
Dashboard reflects updated classification
```

### 6.3 Dashboard 查询

```text
Dashboard loads
↓
Dashboard queries Data Layer
↓
Data Layer reads IndexedDB
↓
Dashboard renders:
  - stats
  - due reviews
  - filtered mistake list
```

## 7. 消息通信设计

Chrome 插件各部分通过 runtime message 通信。

### 7.1 Message Types

```ts
type ExtensionMessage =
  | CaptureFailedSubmissionMessage
  | UpdateMistakeReasonMessage
  | GetDashboardSummaryMessage
  | GetProblemDetailMessage
  | UpdateReviewStateMessage
  | ExportDataMessage
  | ClearAllDataMessage
```

### 7.2 CaptureFailedSubmissionMessage

```ts
type CaptureFailedSubmissionMessage = {
  type: "CAPTURE_FAILED_SUBMISSION"
  payload: {
    problem: ProblemInput
    attempt: SubmissionAttemptInput
  }
}
```

### 7.3 UpdateMistakeReasonMessage

```ts
type UpdateMistakeReasonMessage = {
  type: "UPDATE_MISTAKE_REASON"
  payload: {
    mistakeRecordId: string
    primaryReason: string
    secondaryReason?: string
    note?: string
  }
}
```

## 8. 本地数据库设计

MVP 使用 IndexedDB + Dexie.js。

### 8.1 Stores

```text
problems
attempts
mistakes
reviewStates
reviewLogs
settings
ignoredProblems
```

### 8.2 Dexie Schema

建议索引：

```ts
db.version(1).stores({
  problems: "id, leetcodeId, slug, difficulty, lastSeenAt",
  attempts: "id, problemId, submittedAt, result, language",
  mistakes: "id, problemId, attemptId, primaryReason, secondaryReason, confidence, createdAt",
  reviewStates: "id, problemId, status, mastery, nextReviewAt",
  reviewLogs: "id, problemId, reviewedAt, result",
  settings: "key",
  ignoredProblems: "slug"
})
```

### 8.3 数据写入策略

失败提交发生时：

1. 根据 `slug` 或 `leetcodeId` 查找 Problem
2. 不存在则创建 Problem
3. 存储本次 SubmissionAttempt
4. 创建 MistakeRecord，默认 `confidence = "uncategorized"`
5. 创建或更新 ReviewState
6. 返回 `problemId`、`attemptId`、`mistakeRecordId`

### 8.4 去重策略

LeetCode 页面可能多次渲染同一提交结果。为了避免重复记录，需要生成 attempt fingerprint：

```text
fingerprint = hash(problemSlug + result + language + code + submittedAtWindow)
```

MVP 中可以使用较简单策略：

- 在 content script 内保存最近一次捕捉的 fingerprint
- 同一 fingerprint 在 10 秒内不重复发送
- background 层也检查最近 attempt，避免重复插入

## 9. LeetCode 页面采集策略

### 9.1 题目信息采集

优先从页面 DOM 读取：

- 题目标题
- 题号
- slug
- URL
- 难度
- 标签

slug 可以从 URL 中解析：

```text
https://leetcode.com/problems/two-sum/
slug = two-sum
```

### 9.2 代码采集

LeetCode 编辑器通常基于 Monaco Editor。MVP 采集策略：

1. 优先读取页面中可访问的 editor model 内容
2. 如果无法直接访问，尝试从 DOM 中提取可见代码文本
3. 如果仍失败，记录 `codeCaptureStatus = "failed"`，但仍保存题目和错误类型

为了稳定性，数据模型可扩展字段：

```ts
codeCaptureStatus: "success" | "partial" | "failed"
```

### 9.3 失败结果采集

MVP 通过 MutationObserver 监听页面结果区域变化。

需要识别的状态：

- Wrong Answer
- Time Limit Exceeded
- Runtime Error
- Compile Error

可选提取：

- errorMessage
- failedTestCase
- expectedOutput
- actualOutput

### 9.4 不记录 Run Code

MVP 只记录 Submit 后的失败，不记录 Run Code。

原因：

- Submit 更能代表用户正式判断
- Run Code 失败频率更高，噪音更多
- 第一版数据质量优先

## 10. 复习调度设计

MVP 使用简单可解释规则。

初始记录：

```text
status = "to_review"
mastery = 1
nextReviewAt = submittedAt + 1 day
reviewCount = 0
```

用户复习后：

```text
failed_again -> nextReviewAt = today + 1 day, mastery = max(1, mastery - 1)
forgot -> nextReviewAt = today + 1 day, mastery = max(1, mastery - 1)
partially_remembered -> nextReviewAt = today + 3 days, mastery = min(5, mastery + 1)
remembered -> nextReviewAt = today + 7 days, mastery = min(5, mastery + 1)
solved_again -> nextReviewAt = today + 7 days, mastery = min(5, mastery + 2)
```

当 `mastery >= 4` 且连续两次正向复习时：

```text
status = "mastered"
```

## 11. Dashboard 查询设计

### 11.1 顶部统计

需要查询：

- 今日待复习数量：`reviewStates.nextReviewAt <= today && status != mastered`
- 本周新增错题数量：`mistakes.createdAt >= startOfWeek`
- 最高频错因：按 `primaryReason` 聚合
- 最薄弱标签：结合 Problem tags 与 mistake frequency 聚合

### 11.2 错题列表

默认排序：

```text
nextReviewAt asc
lastFailedAt desc
```

支持筛选：

- difficulty
- tags
- primaryReason
- review status
- result
- date range

## 12. 设置设计

MVP 设置项：

```ts
type Settings = {
  autoCaptureFailedSubmissions: boolean
  showInPagePanel: boolean
  defaultReviewEnabled: boolean
  exportFormat: "json" | "markdown"
}
```

默认值：

```ts
{
  autoCaptureFailedSubmissions: true,
  showInPagePanel: true,
  defaultReviewEnabled: true,
  exportFormat: "json"
}
```

## 13. 隐私与安全

MVP 隐私原则：

- 用户代码默认只存本地
- 不上传任何题目代码、错误信息或用户备注
- 不引入远程执行代码
- 不申请不必要的浏览器权限
- 提供导出和清空数据能力

后期如加入云同步，需要新增：

- 用户登录
- API 鉴权
- 数据加密传输
- 删除账号与删除云端数据
- 隐私政策

## 14. 错误处理

需要处理的关键异常：

- LeetCode 页面结构变化导致采集失败
- 代码编辑器内容无法读取
- 提交结果重复渲染导致重复记录
- IndexedDB 写入失败
- Dashboard 查询为空
- 用户清空数据后 UI 状态未刷新

降级策略：

- 如果代码采集失败，仍保存题目、语言、提交结果和错误信息
- 如果标签采集失败，允许 tags 为空数组
- 如果错因未选择，保存为 `uncategorized`
- 如果 Dashboard 没有数据，展示空状态

## 15. 测试策略

MVP 测试重点：

- 数据模型和 repository 单元测试
- 复习调度规则单元测试
- message handler 单元测试
- content script extraction 函数测试
- dashboard filter 测试
- 手动端到端测试 LeetCode 提交流程

建议测试用例：

- Wrong Answer 被记录
- Compile Error 被记录
- Time Limit Exceeded 被记录
- Runtime Error 被记录
- Accepted 不创建 MistakeRecord
- 同一次提交不会重复记录
- 用户更新错因后 Dashboard 正确显示
- 今日待复习列表正确计算
- JSON / Markdown 导出包含完整数据

## 16. 开发里程碑

### Milestone 1：插件基础架构

- 初始化 TypeScript + React + Vite
- 配置 Manifest V3
- 创建 popup、dashboard、content script、service worker 入口

### Milestone 2：本地数据层

- 配置 IndexedDB + Dexie.js
- 建立 stores 和 repositories
- 实现 Problem / Attempt / Mistake / Review CRUD

### Milestone 3：LeetCode 采集

- 检测题目页
- 监听页面提交结果
- 抓取题目元数据、代码、语言和错误信息
- 实现重复提交去重

### Milestone 4：错因确认 UI

- 实现页面内浮层
- 支持主错因、子错因、备注
- 支持保存、忽略、不记录此题

### Milestone 5：Dashboard

- 实现错题列表
- 实现顶部统计
- 实现筛选
- 实现单题详情页

### Milestone 6：复习与导出

- 实现今日待复习
- 实现复习状态更新
- 实现 JSON / Markdown 导出
- 实现清空数据

## 17. 后续扩展方向

MVP 之后可扩展：

- AI 错因总结
- 周报生成
- Agent Q&A
- PostgreSQL 云同步
- 登录和多设备同步
- 类题推荐
- leetcode.cn 支持

## 18. 参考资料

- Chrome Extensions Manifest V3: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
- Manifest file format: https://developer.chrome.com/docs/extensions/reference/manifest
- Content scripts: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- Message passing: https://developer.chrome.com/docs/extensions/develop/concepts/messaging
- Chrome Extensions storage: https://developer.chrome.com/docs/extensions/develop/concepts/storage

