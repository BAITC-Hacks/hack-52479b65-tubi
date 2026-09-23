import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Question, Task } from "../../contracts/types";
import { emptyCard } from "./shared/constants";
import { setLocale } from "./shared/i18n";
import App from "./App";
import * as businessApi from "./features/business/api";
import * as marketplaceApi from "./features/marketplace/api";
import { request } from "./shared/http";

vi.mock("./features/business/api");
vi.mock("./features/marketplace/api");
vi.mock("./shared/http", async (original) => ({ ...await original<typeof import("./shared/http")>(), request: vi.fn() }));
const task: Task = {
  id: "saved-task", card: { ...emptyCard, title: "Сохранённая карточка" },
  rating: { score: 0, level: "draft", breakdown: [], improvements: [] },
  status: "draft", confirmed: true, created_at: "", updated_at: "",
};
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  setLocale("ru");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.mocked(request).mockResolvedValue({ status: "ok", ai_mode: "fallback" });
  vi.mocked(marketplaceApi.listTasks).mockResolvedValue({ items: [task] });
  vi.mocked(marketplaceApi.listTeams).mockResolvedValue({ items: [] });
  vi.mocked(marketplaceApi.listProposals).mockResolvedValue({ items: [] });
  vi.mocked(businessApi.evaluateTask).mockResolvedValue(task.rating);
});
afterEach(() => { window.history.replaceState(null, "", "/"); vi.resetAllMocks(); vi.restoreAllMocks(); });

it("keeps the mounted business form when the app language changes", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "Создать задачу" }));
  await user.type(screen.getByLabelText("Ваша задача"), "Описание без перевода");
  await user.selectOptions(screen.getByRole("combobox", { name: "Язык интерфейса" }), "kk");
  expect(screen.getByRole("textbox")).toHaveValue("Описание без перевода");
  expect(document.documentElement.lang).toBe("kk");
  expect(screen.getByRole("option", { name: "Қазақша" })).toBeVisible();
  expect(screen.queryByRole("option", { name: "English" })).not.toBeInTheDocument();
});

it("moves keyboard focus to the destination when opening a task", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "Мои задачи" }));
  await user.click(await screen.findByRole("button", { name: /Сохранённая карточка/ }));
  expect(screen.getByRole("main")).toHaveFocus();
});

it("updates My tasks immediately after saving without requiring Open task", async () => {
  const user = userEvent.setup();
  const updated = { ...task, card: { ...task.card, title: "Уточнённая карточка" } };
  vi.mocked(businessApi.saveTask).mockResolvedValue(updated);
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "Мои задачи" }));
  await user.click(await screen.findByRole("button", { name: /Сохранённая карточка/ }));
  await user.click(screen.getByRole("button", { name: "Редактировать" }));
  await user.clear(screen.getByLabelText("Название задачи"));
  await user.type(screen.getByLabelText("Название задачи"), updated.card.title!);
  await user.click(screen.getByRole("button", { name: "Проверить рейтинг и подтвердить" }));
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Подтвердить и сохранить" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Карточка сохранена"));
  await user.click(screen.getByRole("button", { name: "Мои задачи" }));
  expect(screen.getByRole("button", { name: /Уточнённая карточка/ })).toBeVisible();
});

it("keeps a new task on the saved step through App updates and publication retry", async () => {
  const user = userEvent.setup();
  const card = { ...emptyCard, title: "Новая задача кофейни", context: "Читаем отзывы вручную" };
  const saved: Task = { ...task, id: "new-task", card };
  const published: Task = { ...saved, status: "published" };
  const questions: Question[] = [
    { id: "need", fields: ["need"], text: "Что нужно изменить?" },
    { id: "data", fields: ["data"], text: "Какие данные есть?" },
    { id: "result", fields: ["expected_result"], text: "Какой результат нужен?" },
  ];
  vi.mocked(businessApi.prepareTask).mockImplementation(async (input) => ({
    mode: "fallback", card, questions: input.stage === "clarify" ? questions : [],
    warnings: ["Используются шаблонные вопросы."], missing_fields: [],
  }));
  let resolveSave!: (saved: Task) => void;
  vi.mocked(businessApi.saveTask).mockImplementationOnce(() => new Promise<Task>((resolve) => { resolveSave = resolve; }));
  vi.mocked(businessApi.publishTask)
    .mockRejectedValueOnce(new Error("Temporary network failure"))
    .mockResolvedValueOnce(published);
  render(<StrictMode><App /></StrictMode>);
  await user.click(await screen.findByRole("button", { name: "Создать задачу" }));
  fireEvent.change(screen.getByLabelText("Ваша задача"), { target: { value: "Читаем отзывы кофейни вручную" } });
  await user.click(screen.getByRole("button", { name: "Перейти к вопросам" }));
  for (const [index, answer] of ["Находить жалобы", "Таблица CSV", "Отчёт по проблемам"].entries()) {
    fireEvent.change(screen.getByLabelText("Ваш ответ"), { target: { value: answer } });
    await user.click(screen.getByRole("button", { name: index === 2 ? "Собрать карточку" : "Далее" }));
  }
  expect(screen.getByLabelText("Название задачи")).toHaveValue(card.title);
  await user.click(screen.getByRole("button", { name: "Проверить рейтинг и подтвердить" }));
  await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Подтвердить и сохранить" }));
  expect(screen.getByRole("button", { name: "Сохраняем…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Команда" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Мои задачи" })).toBeDisabled();
  expect(businessApi.saveTask).toHaveBeenCalledWith(card, undefined);
  await act(async () => { resolveSave(saved); });

  // onSaved updates App's task list; it must not remount the wizard as an existing card.
  expect(screen.getByRole("status")).toHaveTextContent("Карточка сохранена");
  expect(screen.queryByLabelText("Название задачи")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Опубликовать задачу" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Опубликовать задачу" }));
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Карточка сохранена");
  await user.click(screen.getByRole("button", { name: "Опубликовать задачу" }));
  expect(screen.getByRole("status")).toHaveTextContent("Задача доступна командам");
  expect(businessApi.saveTask).toHaveBeenCalledTimes(1);
  expect(businessApi.publishTask).toHaveBeenNthCalledWith(1, saved.id);
  expect(businessApi.publishTask).toHaveBeenNthCalledWith(2, saved.id);

  vi.mocked(marketplaceApi.listTasks).mockResolvedValue({ items: [task, published] });
  await user.click(screen.getByRole("button", { name: "Открыть задачу" }));
  expect(await screen.findByRole("heading", { name: card.title, level: 1 })).toBeVisible();
  expect(screen.getByRole("button", { name: "Редактировать" })).toBeVisible();
});

it("opens a task from its shareable URL and copies that URL", async () => {
  window.history.replaceState(null, "", "/?task=saved-task");
  const user = userEvent.setup();
  const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  render(<App />);
  expect(await screen.findByRole("heading", { name: task.card.title!, level: 1 })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Скопировать ссылку на задачу" }));
  expect(copy).toHaveBeenCalledWith(window.location.href);
  expect(screen.getByText("Ссылка на задачу скопирована.")).toBeVisible();
});

it("offers a catalog return for an unknown task link", async () => {
  window.history.replaceState(null, "", "/?task=missing");
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Задача не найдена" })).toBeVisible();
});

it("restores task navigation on browser history changes", async () => {
  render(<App />);
  await screen.findByRole("button", { name: "Создать задачу" });
  act(() => {
    window.history.replaceState(null, "", "/?task=saved-task");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(screen.getByRole("heading", { name: task.card.title!, level: 1 })).toBeVisible();
});

it("does not let an older catalog response replace a newer one", async () => {
  const user = userEvent.setup();
  let older!: (value: { items: Task[] }) => void;
  let newer!: (value: { items: Task[] }) => void;
  vi.mocked(marketplaceApi.listTasks)
    .mockImplementationOnce(() => new Promise((resolve) => { older = resolve; }))
    .mockImplementationOnce(() => new Promise((resolve) => { newer = resolve; }));
  render(<StrictMode><App /></StrictMode>);
  const latest = { ...task, card: { ...task.card, title: "Новая версия карточки" } };
  await act(async () => { newer({ items: [latest] }); });
  await user.click(screen.getByRole("button", { name: "Мои задачи" }));
  expect(screen.getByRole("button", { name: /Новая версия карточки/ })).toBeVisible();
  await act(async () => { older({ items: [task] }); });
  expect(screen.getByRole("button", { name: /Новая версия карточки/ })).toBeVisible();
  expect(screen.queryByRole("button", { name: /Сохранённая карточка/ })).not.toBeInTheDocument();
});

it("keeps the catalog available when the AI status endpoint fails", async () => {
  vi.mocked(request).mockRejectedValue(new Error("Health unavailable"));
  render(<App />);
  expect(await screen.findByRole("button", { name: "Создать задачу" })).toBeVisible();
  expect(screen.getByText("Статус AI пока неизвестен")).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
