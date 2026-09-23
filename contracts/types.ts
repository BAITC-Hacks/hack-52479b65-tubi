export type Category =
  "analytics" | "automation" | "education" | "marketing" | "other";
export type Level = "draft" | "working" | "ready" | "priority";
export type Card = {
  title: string | null;
  category: Category;
  context: string | null;
  need: string | null;
  users: string | null;
  data: string | null;
  expected_result: string | null;
  success_criteria: string | null;
  constraints: string | null;
  contact: string | null;
  interaction_format: string | null;
};
export type CardField = Exclude<keyof Card, "category">;
export type Rating = {
  score: number;
  level: Level;
  breakdown: { key: string; earned: number; max: number }[];
  improvements: { fields: CardField[]; message: string }[];
};
export type Task = {
  id: string;
  card: Card;
  rating: Rating;
  confirmed: boolean;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
};
export type Question = { id: string; fields: CardField[]; text: string };
export type Answer = {
  question_id: string;
  fields: CardField[];
  question: string;
  answer: string;
};
export type AIRequest = {
  stage: "clarify" | "compose";
  category: Category;
  description: string;
  answers: Answer[];
};
export type AIResponse = {
  mode: "live" | "fallback";
  card: Card;
  questions: Question[];
  missing_fields: CardField[];
  warnings: string[];
};
export type Team = {
  id: string;
  name: string;
  interests: string[];
  skills: string[];
  technologies: string[];
};
export type ProposalInput = {
  team_id: string;
  idea: string;
  plan: string;
  deadline: string;
  prototype_url: string | null;
};
export type Proposal = ProposalInput & {
  id: string;
  task_id: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  milestone_confirmed: boolean;
  points: number;
};
export type Health = { status: string; ai_mode: "live" | "fallback" };
