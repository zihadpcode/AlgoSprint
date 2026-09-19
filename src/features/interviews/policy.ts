import { answerSchema, EMPTY_ANSWER, type InterviewAnswer } from "./contracts";
export function readAnswer(value: string | null): InterviewAnswer {
  return value === null ? { ...EMPTY_ANSWER } : answerSchema.parse(JSON.parse(value));
}
export function remainingMs(startedAt: Date, duration: number, now = new Date()) {
  return Math.max(0, Math.min(duration * 60000, startedAt.getTime() + duration * 60000 - now.getTime()));
}
export function assessment(answer: InterviewAnswer) {
  const dimensions = [["reasoning", "reasoningRating"], ["tradeoffs", "tradeoffsRating"], ["checks", "checksRating"]] as const;
  const points = dimensions.reduce((sum, [field, rating]) => sum + (answer[field].trim() ? answer[rating] : 0), 0);
  const improve = dimensions.filter(([field, rating]) => !answer[field].trim() || answer[rating] < 2).map(([field]) => field);
  return { score: Math.round(points / 6 * 100), feedback: improve.length ? `Next practice: strengthen ${improve.join(", ")}. Compare your response with the reference discussion.` : "You rated all three areas complete. Verify those judgments against the reference and ask a peer for feedback." };
}
