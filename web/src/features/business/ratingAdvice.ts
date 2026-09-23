import type { CardField, Rating } from "../../../../contracts/types";

const groupForField: Partial<Record<CardField, string>> = {
  need: "context", contact: "communication", interaction_format: "communication",
};

export function getNextImprovement(rating: Rating) {
  return rating.improvements.map((improvement) => {
    const groups = new Set(improvement.fields.map((field) => groupForField[field] ?? field));
    const remaining = rating.breakdown
      .filter((item) => groups.has(item.key))
      .reduce((total, item) => total + Math.max(0, item.max - item.earned), 0);
    return { ...improvement, remaining };
  }).filter((item) => item.fields.length > 0)
    .sort((a, b) => b.remaining - a.remaining)[0] ?? null;
}
