import { request, json } from "../../shared/http";
import type {
  AIRequest,
  AIResponse,
  Card,
  Rating,
  Task,
} from "../../../../contracts/types";
export const prepareTask = (input: AIRequest) =>
  request<AIResponse>("/ai/prepare", json("POST", input));
export const evaluateTask = (card: Card) =>
  request<Rating>("/tasks/evaluate", json("POST", { card }));
export const saveTask = (card: Card, id?: string) =>
  request<Task>(
    id ? `/tasks/${id}` : "/tasks",
    json(id ? "PUT" : "POST", { card, confirmed: true }),
  );
export const publishTask = (id: string) =>
  request<Task>(`/tasks/${id}/publish`, json("POST", {}));
