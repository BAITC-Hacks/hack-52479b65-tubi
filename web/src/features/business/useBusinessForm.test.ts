import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIResponse, Rating, Task } from "../../../../contracts/types";
import { emptyCard } from "../../shared/constants";
import * as api from "./api";
import { useBusinessForm } from "./useBusinessForm";

vi.mock("./api");
const rating: Rating = { score: 20, level: "draft", breakdown: [], improvements: [] };
const task: Task = {
  id: "task-1", card: { ...emptyCard, title: "Отзывы кофейни" }, rating,
  confirmed: true, status: "draft", created_at: "", updated_at: "",
};
const prepared: AIResponse = {
  mode: "fallback", card: task.card, missing_fields: [], warnings: [],
  questions: [
    { id: "need", fields: ["need"], text: "Что изменить?" },
    { id: "data", fields: ["data"], text: "Какие данные есть?" },
    { id: "result", fields: ["expected_result"], text: "Какой результат?" },
  ],
};

describe("business form lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(api.evaluateTask).mockResolvedValue(rating);
    vi.mocked(api.prepareTask).mockResolvedValue(prepared);
    vi.mocked(api.saveTask).mockResolvedValue(task);
    vi.mocked(api.publishTask).mockResolvedValue({ ...task, status: "published" });
  });
  afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });

  it("does not continue with an empty description", async () => {
    const { result } = renderHook(() => useBusinessForm());
    act(() => result.current.setDescription("   "));
    await act(() => result.current.clarify());
    expect(api.prepareTask).not.toHaveBeenCalled();
    expect(result.current.step).toBe("description");
  });

  it("retains answers after an API failure and when going back", async () => {
    const { result } = renderHook(() => useBusinessForm());
    act(() => result.current.setDescription("Анализ отзывов гостей"));
    await act(() => result.current.clarify());
    const answers = { need: "Искать жалобы", data: "CSV с отзывами", result: "Дашборд" };
    act(() => result.current.setAnswers(answers));
    vi.mocked(api.prepareTask).mockRejectedValueOnce(new Error("Connection failed"));
    await act(() => result.current.compose());
    expect(result.current.answers).toEqual(answers);
    expect(result.current.step).toBe("questions");
    act(() => result.current.go("description"));
    await act(() => result.current.clarify());
    expect(result.current.answers).toEqual(answers);
    expect(api.prepareTask).toHaveBeenCalledTimes(2);
  });

  it("keeps questions and manual edits when returning from the card", async () => {
    const { result } = renderHook(() => useBusinessForm());
    act(() => result.current.setDescription("Анализ отзывов гостей"));
    await act(() => result.current.clarify());
    act(() => result.current.setAnswers({ need: "Анализ", data: "CSV", result: "Отчёт" }));
    vi.mocked(api.prepareTask).mockResolvedValueOnce({ ...prepared, questions: [] });
    await act(() => result.current.compose());
    act(() => result.current.changeCard({ ...task.card, title: "Уточнённое название" }));
    act(() => result.current.go("questions"));
    expect(result.current.questions).toHaveLength(3);
    await act(() => result.current.compose());
    expect(result.current.card.title).toBe("Уточнённое название");
    expect(api.prepareTask).toHaveBeenCalledTimes(2);
  });

  it("resets confirmation after card edits", () => {
    const { result } = renderHook(() => useBusinessForm(task));
    act(() => result.current.setConfirmed(true));
    act(() => result.current.changeCard({ ...task.card, title: "Другое название" }));
    expect(result.current.confirmed).toBe(false);
  });

  it("requires confirmation for both save and publication", async () => {
    const { result } = renderHook(() => useBusinessForm(task));
    await act(() => result.current.save());
    expect(api.saveTask).not.toHaveBeenCalled();
    act(() => result.current.setConfirmed(true));
    await act(() => result.current.save());
    act(() => result.current.setConfirmed(false));
    await act(() => result.current.publish());
    expect(api.publishTask).not.toHaveBeenCalled();
  });

  it("retries publication without creating a second task", async () => {
    const { result } = renderHook(() => useBusinessForm(task));
    act(() => result.current.setConfirmed(true));
    await act(() => result.current.save());
    vi.mocked(api.publishTask).mockRejectedValueOnce(new Error("Connection failed"));
    await act(() => result.current.publish());
    expect(result.current.saved?.id).toBe(task.id);
    await act(() => result.current.publish());
    expect(api.saveTask).toHaveBeenCalledTimes(1);
    expect(api.publishTask).toHaveBeenNthCalledWith(2, task.id);
    expect(result.current.saved?.status).toBe("published");
  });

  it("ignores an older rating response even if the transport ignores abort", async () => {
    let older!: (rating: Rating) => void;
    let newer!: (rating: Rating) => void;
    vi.mocked(api.evaluateTask)
      .mockImplementationOnce(() => new Promise((resolve) => { older = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { newer = resolve; }));
    const { result } = renderHook(() => useBusinessForm(task));
    await act(() => vi.advanceTimersByTimeAsync(250));
    act(() => result.current.changeCard({ ...task.card, data: "CSV with customer feedback" }));
    await act(() => vi.advanceTimersByTimeAsync(250));
    await act(async () => { newer({ ...rating, score: 70, level: "ready" }); });
    await act(async () => { older({ ...rating, score: 10 }); });
    expect(result.current.rating?.score).toBe(70);
  });
});
