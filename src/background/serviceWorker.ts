import {
  captureFailedSubmission,
  discardCapturedSubmission,
  getDashboardSummary,
  updateMistakeReason,
  updateReviewAfterResult
} from "../shared/db";
import { db } from "../shared/db/schema";
import type { ExtensionMessage } from "../shared/types/messages";

chrome.runtime.onInstalled.addListener(() => {
  console.info("LeetLens installed");
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then((response) => sendResponse({ ok: true, data: response }))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown extension error";
      sendResponse({ ok: false, error: message });
    });

  return true;
});

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case "CAPTURE_FAILED_SUBMISSION":
      return captureFailedSubmission(message.payload.problem, message.payload.attempt);

    case "UPDATE_MISTAKE_REASON":
      return updateMistakeReason(
        message.payload.mistakeRecordId,
        message.payload.primaryReason,
        message.payload.secondaryReason,
        message.payload.note
      );

    case "DISCARD_CAPTURED_SUBMISSION":
      return discardCapturedSubmission(message.payload);

    case "GET_DASHBOARD_SUMMARY":
      return getDashboardSummary();

    case "UPDATE_REVIEW_STATE":
      return updateReviewAfterResult(
        message.payload.problemId,
        message.payload.result,
        message.payload.note
      );

    case "CLEAR_ALL_DATA":
      await db.delete();
      await db.open();
      return undefined;

    default:
      assertNever(message);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled message: ${JSON.stringify(value)}`);
}
