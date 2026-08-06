# LeetLens Chrome Extension MVP Implementation Plan

## 1. Document Goal

This document breaks down the LeetLens MVP PRD and technical design into executable engineering milestones.

The project should progress through the following stages:

```text
Project foundation -> Local data layer -> LeetCode extraction -> Mistake classification -> Dashboard -> Review and export
```

Each milestone includes:

- Development tasks
- Acceptance criteria
- Technical risks
- Interview talking points

## 2. Development Principles

The MVP follows these principles:

- Complete the end-to-end loop before optimizing UX
- Use a local-first architecture without login or cloud sync
- Allow graceful fallback when extraction fails
- Keep mistake classification lightweight for the user
- Design the data model for future AI and cloud sync extensions

## 3. Milestone 1: Extension Foundation

### Goal

Create a runnable Chrome Extension MVP foundation.

### Development Tasks

- Initialize a Vite + React + TypeScript project
- Configure Chrome Extension Manifest V3
- Create the background service worker entry
- Create the content script entry
- Create the popup page entry
- Create the dashboard page entry
- Configure basic build scripts
- Configure ESLint / TypeScript checks
- Prepare the base directory structure

### Acceptance Criteria

- Chrome can load the extension via `Load unpacked`
- Clicking the extension icon opens the popup
- The dashboard page can be opened
- The content script runs on `leetcode.com/problems/*`
- The background service worker can receive a test message
- TypeScript compilation passes

### Technical Risks

- Vite multi-entry builds for Chrome extensions require configuration
- Manifest V3 service workers are event-driven and not always running
- Content scripts and extension pages run in different contexts

### Interview Talking Points

- Split the extension into popup, content script, and service worker contexts
- Defined typed communication protocols across extension contexts
- Configured extension permissions using the principle of least privilege

## 4. Milestone 2: Local Data Layer

### Goal

Build the IndexedDB + Dexie.js local persistence layer for mistake data.

### Development Tasks

- Install and configure Dexie.js
- Define core TypeScript types
- Create the IndexedDB schema
- Implement the Problem repository
- Implement the SubmissionAttempt repository
- Implement the MistakeRecord repository
- Implement the ReviewState repository
- Implement the ReviewLog repository
- Implement settings storage
- Add basic seed / mock data

### Acceptance Criteria

- A Problem can be created and queried
- A failed SubmissionAttempt can be saved
- An uncategorized MistakeRecord can be created
- A ReviewState can be created or updated
- Problems due today can be queried
- All local data can be cleared

### Technical Risks

- IndexedDB queries depend heavily on index design
- Schema migration should be considered from version one
- IndexedDB access from a service worker must handle async lifecycle behavior carefully

### Interview Talking Points

- Designed a local-first persistence layer
- Modeled Problem, Attempt, Mistake, and Review as normalized stores
- Used IndexedDB indexes to support dashboard queries and review lists

## 5. Milestone 3: LeetCode Page Extraction

### Goal

Automatically detect failed submissions and extract key data from LeetCode problem pages.

### Development Tasks

- Detect whether the current page is a LeetCode problem page
- Parse the problem slug from the URL
- Extract problem title, number, and difficulty from the DOM
- Attempt to extract problem tags
- Extract the current programming language
- Extract the current editor code
- Use MutationObserver to observe the submission result area
- Detect failed states: Wrong Answer, TLE, Runtime Error, Compile Error
- Extract error message, failed test case, expected output, and actual output
- Generate a submission fingerprint
- Prevent duplicate records for the same submission
- Send capture requests via message passing

### Acceptance Criteria

- Wrong Answer is captured
- Time Limit Exceeded is captured
- Runtime Error is captured
- Compile Error is captured
- The same submission is not recorded twice
- If code extraction fails, the extension still saves problem metadata and error type
- Accepted submissions do not create MistakeRecord entries

### Technical Risks

- LeetCode page structure may change
- Monaco Editor content may not be directly readable from a content script
- Submission results may render asynchronously multiple times
- DOM text and layout may vary due to LeetCode experiments

### Interview Talking Points

- Used MutationObserver to handle SPA-style asynchronous rendering
- Designed fallback extraction paths to preserve core data
- Used fingerprint-based deduplication to avoid duplicate writes

## 6. Milestone 4: Mistake Classification UX

### Goal

Show an in-page panel after failed submissions so users can quickly confirm the mistake reason.

### Development Tasks

- Create the In-Page Mistake Panel
- Display problem title, submission result, and language
- Show primary mistake reason options
- Show secondary mistake reason options
- Support user notes
- Support saving the mistake reason
- Support ignoring the current record
- Support excluding the current problem from tracking
- Support closing the panel
- Show save confirmation feedback

### Acceptance Criteria

- The panel appears automatically after failed submissions
- Users can select a primary mistake reason within a few seconds
- Saved mistake reasons appear in the Dashboard
- If the user does not classify the mistake, the record remains uncategorized
- If a problem is excluded, future failed submissions for that problem are not auto-saved

### Technical Risks

- LeetCode page styles may affect the injected panel
- React UI injected by a content script needs style isolation
- The panel must not block the core problem-solving workflow

### Interview Talking Points

- Split automatic fact capture from user-confirmed classification to improve data quality
- Injected controlled UI into a third-party page while avoiding style pollution
- Optimized the flow to reduce manual mistake-tracking overhead

## 7. Milestone 5: Dashboard and Problem Detail

### Goal

Implement mistake management, filtering, statistics, and per-problem review pages.

### Development Tasks

- Create the dashboard layout
- Implement top stats cards
- Implement today's review list
- Implement the mistake list
- Implement filters: difficulty, tag, mistake reason, status, result, date range
- Implement sorting: next review date, last failed time, failure count
- Implement the problem detail page
- Show historical failed submissions
- Show failed code and error messages
- Support editing mistake reasons and notes
- Support deleting records
- Support opening the original LeetCode problem

### Acceptance Criteria

- The Dashboard shows all tracked mistakes
- Top stats are computed correctly
- Filters work correctly
- Problem detail pages show historical failed attempts
- Users can edit mistake reasons and notes
- Users can open the original LeetCode problem

### Technical Risks

- IndexedDB aggregation may need to happen in the application layer
- Combining multiple filters can complicate state management
- Code display must handle long text and formatting

### Interview Talking Points

- Designed a dashboard around review decisions instead of raw activity tracking
- Generated analytics from local indexed data and application-layer aggregation
- Aggregated attempts by problem while preserving historical failed submission details

## 8. Milestone 6: Review State, Export, and Settings

### Goal

Complete the review loop, data export, and user settings.

### Development Tasks

- Implement ReviewState update logic
- Implement ReviewLog creation logic
- Support review results: forgot, partially remembered, remembered, solved again, failed again
- Compute nextReviewAt based on review result
- Support JSON export
- Support Markdown export
- Support clearing all local data
- Support automatic recording toggle
- Support in-page panel toggle
- Support default review tracking toggle

### Acceptance Criteria

- Today's review list is generated correctly from nextReviewAt
- Review results correctly update the next review date
- Repeated positive reviews can mark a problem as mastered
- JSON export includes all core data
- Markdown export is human-readable
- Clearing data returns the Dashboard to an empty state
- Settings take effect

### Technical Risks

- Review date calculation must handle local time zones
- Export logic must avoid missing related records
- Clearing data must delete records consistently across all stores

### Interview Talking Points

- Implemented an explainable spaced repetition scheduling policy
- Supported data portability and user privacy controls
- Used review logs to build long-term learning behavior data

## 9. Recommended Development Order

Recommended build order:

```text
1. Initialize project foundation
2. Define types and data models
3. Implement the Dexie local data layer
4. Build popup and dashboard with mock data
5. Implement basic content script detection
6. Connect content script -> background -> IndexedDB
7. Implement the in-page mistake classification panel
8. Complete dashboard filters and problem detail pages
9. Implement review scheduling rules
10. Implement export, clear data, and settings
11. Run end-to-end and manual testing
```

This order helps:

- Ensure the extension runs early
- Stabilize the data layer before page extraction
- Address LeetCode extraction uncertainty early
- Complete UX and review flows after the core capture path works

## 10. MVP Definition of Done

The MVP is complete when:

- The extension can be installed and loaded
- Failed submissions on leetcode.com are automatically captured
- Captured records include problem metadata, language, code, result, and error information
- Users can classify mistake reasons and add notes
- The Dashboard can display and filter mistakes
- Problem detail pages show historical failed attempts
- Users can complete reviews and update mastery status
- Users can export JSON / Markdown data
- Users can clear all local data

## 11. Interview Project Narrative

Project pitch:

```text
I built LeetLens, a local-first Chrome extension that automatically captures failed LeetCode submissions and turns them into a structured mistake review system for coding interview preparation.
```

Engineering points to highlight:

- Manifest V3 Chrome Extension architecture
- Content script extraction from a third-party SPA
- Background service worker message routing
- IndexedDB / Dexie local-first persistence
- Normalized client-side data model
- Deduplication strategy for repeated DOM updates
- Review scheduling algorithm
- Privacy-first design
- React dashboard with filtering and aggregation

## 12. Resume Bullet Drafts

English resume bullets:

```text
- Built LeetLens, a Manifest V3 Chrome extension using TypeScript and React to automatically capture failed LeetCode submissions and convert them into structured mistake review records.
- Designed a local-first IndexedDB/Dexie persistence layer with normalized stores for problems, submission attempts, mistake classifications, and spaced repetition review states.
- Implemented content scripts with DOM observation and deduplication logic to extract problem metadata, source code, runtime errors, and failed test cases from LeetCode pages.
- Developed a React dashboard for filtering coding mistakes by topic, difficulty, error category, frequency, and next review date.
```

