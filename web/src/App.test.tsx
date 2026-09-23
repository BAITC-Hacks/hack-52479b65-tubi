import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Task } from "../../contracts/types";
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
  setLocale("ru");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.mocked(request).mockResolvedValue({ status: "ok", ai_mode: "fallback" });
  vi.mocked(marketplaceApi.listTasks).mockResolvedValue({ items: [task] });
  vi.mocked(marketplaceApi.listTeams).mockResolvedValue({ items: [] });
  vi.mocked(marketplaceApi.listProposals).mockResolvedValue({ items: [] });
  vi.mocked(businessApi.evaluateTask).mockResolvedValue(task.rating);
});
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });

it("keeps the mounted business form when the app language changes", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "Создать задачу" }));
  await user.type(screen.getByLabelText("Ваша задача"), "Описание без перевода");
  await user.selectOptions(screen.getByRole("combobox", { name: "Язык интерфейса" }), "en");
  expect(screen.getByLabelText("Your task")).toHaveValue("Описание без перевода");
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
