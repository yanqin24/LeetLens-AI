# LeetLens Chrome Extension MVP PRD

## 1. Product Overview

**Product Name:** LeetLens

**Product Type:** Chrome Extension

**Target Users:** Students and job seekers preparing for North American SDE interviews with LeetCode

**Core Goal:** Automatically capture failed LeetCode submissions and help users organize mistakes, understand error patterns, and review problems effectively.

The MVP is not a full AI agent. It is a local-first LeetCode mistake tracking and review system. Its core value is turning failed submissions into structured, reviewable, and searchable learning data.

## 2. Problem Statement

Users often face these issues while practicing LeetCode:

- Failed submissions are not systematically recorded
- Manual mistake tracking interrupts the problem-solving flow
- During review, users remember which problem they missed but not why
- Repeated mistake patterns are hard to identify
- Users lack a personal review plan based on their own mistakes

## 3. MVP Goals

The MVP should complete the following product loop:

```text
Failed submission -> Automatic capture -> User confirms mistake reason -> Mistake record -> Scheduled review
```

MVP goals:

- Automatically detect failed LeetCode submissions
- Save problem metadata, source code, submission result, and error details
- Allow users to quickly classify the mistake reason and add notes
- Provide a mistake Dashboard
- Show historical failed attempts per problem
- Provide a daily review list
- Store all data locally by default
- Support data export and deletion

## 4. Non-Goals

The MVP will not include:

- AI-based automatic mistake analysis
- AI agent Q&A
- User accounts
- Cloud sync
- Multi-device sync
- leetcode.cn support
- Run Code failure tracking
- Similar problem recommendations
- Community features
- Advanced analytics charts

## 5. Scope

The MVP supports:

```text
leetcode.com
```

It only records:

```text
Failed Submit results
```

Supported failed result types:

- Wrong Answer
- Time Limit Exceeded
- Runtime Error
- Compile Error

Accepted submissions are not stored as mistake records in the MVP, but they may update the problem status.

## 6. Core User Flows

### 6.1 Failed Submission Capture

```text
User clicks Submit on LeetCode
↓
LeetCode returns a failed result
↓
Extension detects the submission status
↓
Extension captures problem metadata, code, language, and error details
↓
Extension creates a SubmissionAttempt record
↓
An in-page panel shows “Mistake recorded”
↓
User selects mistake reason and optional note
↓
MistakeRecord is updated
```

Default behavior:

- Failed submissions are automatically saved as uncategorized mistakes
- The record remains even if the user does not classify the mistake immediately
- Users can later update the mistake reason from the Dashboard

### 6.2 Reviewing Mistakes

```text
User opens the Dashboard
↓
User sees today’s review list
↓
User opens a problem detail page
↓
User reviews previous failed code, error message, and mistake reason
↓
User revisits or resolves the problem
↓
User marks review result
↓
System updates the next review date
```

### 6.3 Finding Weak Areas

```text
User opens the Dashboard
↓
User checks frequent mistake types and weak tags
↓
User filters problems by mistake reason or topic tag
↓
User reviews similar mistakes in a focused session
```

## 7. Page Structure

### 7.1 In-Page LeetCode Panel

Triggered after a failed Submit result.

Displayed fields:

- Problem title
- Submission result
- Programming language
- Primary mistake reason
- Optional secondary reason
- User note
- Save status

User actions:

- Select primary reason
- Select secondary reason
- Add note
- Save
- Ignore
- Mark problem as not tracked

### 7.2 Extension Popup

Shown when the user clicks the Chrome extension icon.

Displayed fields:

- Number of problems due today
- Number of new mistakes this week
- Three most recent mistake records
- Whether the current page is a LeetCode problem page
- Button to open Dashboard

The Popup acts as a quick entry point, not a full management interface.

### 7.3 Dashboard

The Dashboard is the main management page.

Top stats:

- Problems due today
- New mistakes this week
- Most frequent mistake reason
- Weakest problem tag

Filters:

- Mistake reason
- Difficulty
- Topic tag
- Review status
- Submission result
- Date range

Mistake list fields:

- Problem number
- Problem title
- Difficulty
- Tags
- Last failed time
- Failure count
- Latest failed result
- Primary mistake reason
- Next review date
- Mastery status

### 7.4 Problem Detail Page

Displayed fields:

- Problem metadata
- Original LeetCode URL
- Historical failed submissions
- Failed code snapshots
- Error messages
- Mistake classifications
- User notes
- Review history
- Current mastery status

User actions:

- Edit mistake reason
- Add note
- Mark review result
- Delete record
- Open original LeetCode problem

## 8. Mistake Taxonomy

The MVP uses a two-level classification system.

### 8.1 Primary Reasons

```text
1. Syntax / API Error
2. Problem Understanding Error
3. Algorithmic Approach Error
4. Missing Edge Case
5. Implementation Detail Error
6. Complexity Issue
7. Debugging Habit Issue
```

### 8.2 Secondary Reasons

**Syntax / API Error**

- Syntax mistake
- Incorrect variable name
- Type error
- Misused standard library API
- Unfamiliar language feature

**Problem Understanding Error**

- Misunderstood input/output
- Missed constraints
- Misunderstood target condition
- Missed special rule

**Algorithmic Approach Error**

- Wrong algorithm choice
- Wrong data structure choice
- Incorrect state definition
- Incorrect transition relation
- Incorrect greedy condition
- Incorrect search pruning

**Missing Edge Case**

- Empty input
- Single element
- Duplicate elements
- Negative numbers / zero
- Out-of-bounds
- Min/max values
- Odd/even length

**Implementation Detail Error**

- Indexing error
- Incorrect loop condition
- Incorrect initialization
- Wrong update order
- Wrong return value
- Incorrect pointer movement

**Complexity Issue**

- Time complexity too high
- Space complexity too high
- Repeated computation
- Missing memoization
- Inefficient data structure operation

**Debugging Habit Issue**

- Did not manually test examples
- Did not check extreme cases
- Introduced bug after modification
- Submitted too early
- Did not verify complexity

## 9. Data Model

### 9.1 Problem

```ts
type Problem = {
  id: string
  leetcodeId: string
  title: string
  slug: string
  url: string
  difficulty: "Easy" | "Medium" | "Hard"
  tags: string[]
  firstSeenAt: string
  lastSeenAt: string
}
```

### 9.2 SubmissionAttempt

```ts
type SubmissionAttempt = {
  id: string
  problemId: string
  submittedAt: string
  language: string
  code: string
  result:
    | "Wrong Answer"
    | "Time Limit Exceeded"
    | "Runtime Error"
    | "Compile Error"
    | "Accepted"
  errorMessage?: string
  failedTestCase?: string
  expectedOutput?: string
  actualOutput?: string
}
```

### 9.3 MistakeRecord

```ts
type MistakeRecord = {
  id: string
  problemId: string
  attemptId: string
  primaryReason: string
  secondaryReason?: string
  note?: string
  confidence: "user_confirmed" | "auto_detected" | "uncategorized"
  createdAt: string
  updatedAt: string
}
```

### 9.4 ReviewState

```ts
type ReviewState = {
  id: string
  problemId: string
  status: "new" | "to_review" | "reviewing" | "mastered"
  mastery: 1 | 2 | 3 | 4 | 5
  nextReviewAt: string
  lastReviewedAt?: string
  reviewCount: number
}
```

### 9.5 ReviewLog

```ts
type ReviewLog = {
  id: string
  problemId: string
  reviewedAt: string
  result:
    | "remembered"
    | "partially_remembered"
    | "forgot"
    | "solved_again"
    | "failed_again"
  note?: string
}
```

## 10. Technical Requirements

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

Storage strategy:

- IndexedDB: problems, attempts, mistake records, and review records
- chrome.storage.local: user settings

Privacy defaults:

- All data is stored locally
- Source code is not uploaded in the MVP
- Users can export data
- Users can delete all local data

## 11. Review Scheduling Rules

The MVP uses a simple and explainable scheduling policy:

```text
First mistake: review after 1 day
Failed review: review after 1 day
Partially remembered: review after 3 days
Remembered once: review after 7 days
Remembered twice consecutively: mark as mastered
```

## 12. MVP Success Metrics

The MVP is successful if:

- Failed submissions can be captured automatically
- Mistake records are saved reliably
- Users are willing to classify mistake reasons
- The Dashboard helps users find problems due for review
- Users can identify weak areas from mistake categories and topic tags
- Data can be exported and deleted reliably

## 13. MVP Development Milestones

### Milestone 1: Extension Foundation

- Create a Manifest V3 Chrome extension
- Configure TypeScript, React, and Vite
- Implement basic popup, dashboard, and content script entry points

### Milestone 2: LeetCode Failed Submission Detection

- Detect leetcode.com problem pages
- Observe post-submit result changes
- Capture problem metadata, language, code, and error details
- Prevent duplicate records for the same submission

### Milestone 3: Local Data Layer

- Use IndexedDB with Dexie.js
- Create stores for Problem, SubmissionAttempt, MistakeRecord, ReviewState, and ReviewLog
- Implement CRUD operations and basic indexes

### Milestone 4: Mistake Classification UX

- Implement the in-page LeetCode panel
- Support primary reason, secondary reason, and notes
- Support ignoring or excluding a problem from tracking

### Milestone 5: Dashboard and Review Flow

- Implement the mistake list
- Implement filters and basic stats
- Implement the problem detail page
- Implement review status updates

### Milestone 6: Export and Settings

- Support JSON / Markdown export
- Support deleting all local data
- Support automatic recording settings

