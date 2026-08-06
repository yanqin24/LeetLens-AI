export type MistakeConfidence = "user_confirmed" | "auto_detected" | "uncategorized";

export type MistakeRecord = {
  id: string;
  problemId: string;
  attemptId: string;
  primaryReason: string;
  secondaryReason?: string;
  note?: string;
  confidence: MistakeConfidence;
  createdAt: string;
  updatedAt: string;
};
