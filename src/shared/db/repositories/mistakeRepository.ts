import { db } from "../schema";
import type { MistakeRecord } from "../../types/mistake";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/date";

export async function createUncategorizedMistake(
  problemId: string,
  attemptId: string
): Promise<MistakeRecord> {
  const now = nowIso();
  const mistake: MistakeRecord = {
    id: createId("mistake"),
    problemId,
    attemptId,
    primaryReason: "Uncategorized",
    confidence: "uncategorized",
    createdAt: now,
    updatedAt: now
  };

  await db.mistakes.add(mistake);
  return mistake;
}

export async function updateMistakeReason(
  mistakeRecordId: string,
  primaryReason: string,
  secondaryReason?: string,
  note?: string
): Promise<void> {
  await db.mistakes.update(mistakeRecordId, {
    primaryReason,
    secondaryReason,
    note,
    confidence: "user_confirmed",
    updatedAt: nowIso()
  });
}

export async function listMistakes(): Promise<MistakeRecord[]> {
  return db.mistakes.orderBy("createdAt").reverse().toArray();
}

export async function listMistakesForProblem(problemId: string): Promise<MistakeRecord[]> {
  return db.mistakes.where("problemId").equals(problemId).reverse().sortBy("createdAt");
}
