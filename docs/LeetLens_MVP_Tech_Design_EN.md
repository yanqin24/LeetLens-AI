# LeetLens Chrome Extension MVP Technical Design

## 1. Document Goal

This document defines the technical architecture, module boundaries, data flow, local persistence design, message passing strategy, and key implementation decisions for the LeetLens MVP.

The technical design supports the first product loop:

```text
Failed submission -> Automatic capture -> User confirms mistake reason -> Local mistake notebook -> Scheduled review
```

## 2. Tech Stack

Recommended stack:

```text
TypeScript
React
Vite
Chrome Extension Manifest V3
IndexedDB
Dexie.js
chrome.storage.local
```

Rationale:

- TypeScript: shared type safety across extension modules, UI, data models, and future backend services
- React: suitable for popup, dashboard, problem detail pages, and mistake classification UI
- Vite: fast development and bundling for modern frontend code and extension pages
- Manifest V3: current Chrome extension platform standard, using service workers for background logic
- IndexedDB + Dexie.js: structured local persistence, indexed queries, and offline-first behavior
- chrome.storage.local: lightweight extension settings storage

## 3. System Architecture

The MVP has five main parts:

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

Module responsibilities:

- Content Script: injected into LeetCode pages to detect submission results, extract page data, and render the in-page panel
- Background Service Worker: routes messages, calls the local data layer, and handles extension lifecycle events
- Local Data Layer: wraps IndexedDB / Dexie operations
- Popup: lightweight browser extension entry point
- Dashboard: main mistake management interface
- Problem Detail: per-problem review and history page

## 4. Chrome Extension Structure

Recommended directory structure:

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

Notes:

- `content/` owns LeetCode page-specific logic
- `background/` owns extension-level message routing and lifecycle handling
- `shared/db/` encapsulates all data access
- `shared/types/` defines types shared across modules
- `dashboard/` owns the full management UI
- `popup/` owns the quick entry UI

## 5. Manifest V3 Design

Key manifest configuration for the MVP:

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

The MVP does not need:

- `tabs`
- `scripting`
- `identity`
- remote hosted code
- broad host permissions

Permission principles:

- Request only what the MVP needs
- Match only `leetcode.com/problems/*`
- Store data locally by default
- Do not upload user source code

## 6. Data Flow Design

### 6.1 Failed Submission Capture

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

### 6.2 User Confirms Mistake Reason

```text
User selects primary reason / secondary reason / note
↓
Content Script sends UPDATE_MISTAKE_REASON
↓
Background updates MistakeRecord
↓
Dashboard reflects updated classification
```

### 6.3 Dashboard Query Flow

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

## 7. Message Passing Design

Extension contexts communicate through Chrome runtime messaging.

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

## 8. Local Database Design

The MVP uses IndexedDB with Dexie.js.

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

Recommended indexes:

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

### 8.3 Write Strategy

When a failed submission occurs:

1. Find the Problem by `slug` or `leetcodeId`
2. Create the Problem if it does not exist
3. Insert a SubmissionAttempt
4. Create a MistakeRecord with `confidence = "uncategorized"`
5. Create or update the ReviewState
6. Return `problemId`, `attemptId`, and `mistakeRecordId`

### 8.4 Deduplication Strategy

LeetCode may re-render the same submission result multiple times. To avoid duplicate records, generate an attempt fingerprint:

```text
fingerprint = hash(problemSlug + result + language + code + submittedAtWindow)
```

MVP strategy:

- Store the latest captured fingerprint in the content script
- Do not send the same fingerprint twice within 10 seconds
- Also check recent attempts in the background layer before inserting

## 9. LeetCode Page Extraction Strategy

### 9.1 Problem Metadata

Prefer reading visible page DOM:

- Problem title
- Problem number
- Slug
- URL
- Difficulty
- Tags

The slug can be parsed from the URL:

```text
https://leetcode.com/problems/two-sum/
slug = two-sum
```

### 9.2 Code Extraction

LeetCode commonly uses Monaco Editor. MVP extraction strategy:

1. Prefer reading the accessible editor model content
2. If direct access fails, try extracting visible code text from the DOM
3. If code extraction still fails, set `codeCaptureStatus = "failed"` and save problem metadata plus error type

Recommended extensible field:

```ts
codeCaptureStatus: "success" | "partial" | "failed"
```

### 9.3 Failed Result Extraction

Use `MutationObserver` to observe changes in the result area.

Supported result states:

- Wrong Answer
- Time Limit Exceeded
- Runtime Error
- Compile Error

Optional extraction fields:

- errorMessage
- failedTestCase
- expectedOutput
- actualOutput

### 9.4 Run Code Exclusion

The MVP records only failed Submit results and does not record Run Code failures.

Reasons:

- Submit represents a more intentional evaluation
- Run Code failures are noisier
- MVP prioritizes data quality

## 10. Review Scheduling Design

The MVP uses a simple and explainable scheduling rule.

Initial record:

```text
status = "to_review"
mastery = 1
nextReviewAt = submittedAt + 1 day
reviewCount = 0
```

After review:

```text
failed_again -> nextReviewAt = today + 1 day, mastery = max(1, mastery - 1)
forgot -> nextReviewAt = today + 1 day, mastery = max(1, mastery - 1)
partially_remembered -> nextReviewAt = today + 3 days, mastery = min(5, mastery + 1)
remembered -> nextReviewAt = today + 7 days, mastery = min(5, mastery + 1)
solved_again -> nextReviewAt = today + 7 days, mastery = min(5, mastery + 2)
```

When `mastery >= 4` and the user has two consecutive positive review results:

```text
status = "mastered"
```

## 11. Dashboard Query Design

### 11.1 Top Stats

Queries needed:

- Problems due today: `reviewStates.nextReviewAt <= today && status != mastered`
- New mistakes this week: `mistakes.createdAt >= startOfWeek`
- Most frequent mistake reason: aggregate by `primaryReason`
- Weakest problem tag: aggregate Problem tags with mistake frequency

### 11.2 Mistake List

Default sort:

```text
nextReviewAt asc
lastFailedAt desc
```

Supported filters:

- difficulty
- tags
- primaryReason
- review status
- result
- date range

## 12. Settings Design

MVP settings:

```ts
type Settings = {
  autoCaptureFailedSubmissions: boolean
  showInPagePanel: boolean
  defaultReviewEnabled: boolean
  exportFormat: "json" | "markdown"
}
```

Default values:

```ts
{
  autoCaptureFailedSubmissions: true,
  showInPagePanel: true,
  defaultReviewEnabled: true,
  exportFormat: "json"
}
```

## 13. Privacy and Security

MVP privacy principles:

- User code is stored locally by default
- No source code, error information, or user notes are uploaded
- No remotely hosted code is used
- No unnecessary browser permissions are requested
- Users can export and delete all data

If cloud sync is added later, the product should add:

- User authentication
- API authorization
- Encrypted transport
- Account deletion and cloud data deletion
- Privacy policy

## 14. Error Handling

Key failure cases:

- LeetCode page structure changes and extraction fails
- Code editor content cannot be read
- Submission result re-renders and causes duplicate events
- IndexedDB write fails
- Dashboard query returns no data
- UI does not refresh after clearing data

Fallback behavior:

- If code extraction fails, still save problem metadata, language, result, and error information
- If tag extraction fails, allow `tags = []`
- If the user does not select a mistake reason, save the record as `uncategorized`
- If the Dashboard has no data, show an empty state

## 15. Testing Strategy

MVP testing priorities:

- Data model and repository unit tests
- Review scheduling unit tests
- Message handler unit tests
- Content script extraction function tests
- Dashboard filter tests
- Manual end-to-end testing on LeetCode submission flows

Recommended test cases:

- Wrong Answer is recorded
- Compile Error is recorded
- Time Limit Exceeded is recorded
- Runtime Error is recorded
- Accepted does not create a MistakeRecord
- The same submission is not recorded twice
- Updating mistake reason is reflected in the Dashboard
- Today’s review list is computed correctly
- JSON / Markdown export includes complete data

## 16. Development Milestones

### Milestone 1: Extension Foundation

- Initialize TypeScript + React + Vite
- Configure Manifest V3
- Create popup, dashboard, content script, and service worker entry points

### Milestone 2: Local Data Layer

- Configure IndexedDB + Dexie.js
- Create stores and repositories
- Implement Problem / Attempt / Mistake / Review CRUD

### Milestone 3: LeetCode Extraction

- Detect problem pages
- Observe submission result changes
- Extract problem metadata, code, language, and error details
- Implement duplicate submission prevention

### Milestone 4: Mistake Classification UX

- Implement the in-page panel
- Support primary reason, secondary reason, and notes
- Support save, ignore, and exclude-problem actions

### Milestone 5: Dashboard

- Implement mistake list
- Implement top stats
- Implement filters
- Implement problem detail page

### Milestone 6: Review and Export

- Implement today’s review list
- Implement review status updates
- Implement JSON / Markdown export
- Implement clear all local data

## 17. Future Extensions

Post-MVP extensions:

- AI mistake summaries
- Weekly review reports
- Agent Q&A
- PostgreSQL cloud sync
- Authentication and multi-device sync
- Similar problem recommendations
- leetcode.cn support

## 18. References

- Chrome Extensions Manifest V3: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
- Manifest file format: https://developer.chrome.com/docs/extensions/reference/manifest
- Content scripts: https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
- Message passing: https://developer.chrome.com/docs/extensions/develop/concepts/messaging
- Chrome Extensions storage: https://developer.chrome.com/docs/extensions/develop/concepts/storage

