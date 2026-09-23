import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Proposal, Task, Team } from "../../../../contracts/types";
import { emptyCard } from "../../shared/constants";
import { ApiError } from "../../shared/http";
import { setLocale } from "../../shared/i18n";
import { CatalogPage, DetailPage, ProposalsPage } from "./Marketplace";
import * as api from "./api";

vi.mock("./api");
const task: Task = { id: "task-test", card: { ...emptyCard, title: "Отзывы кофейни", category: "other" },
  rating: { score: 10, level: "draft", breakdown: [], improvements: [] }, confirmed: true, status: "published", created_at: "", updated_at: "" };
const team: Team = { id: "team-test", name: "Команда Алматы", interests: [], skills: ["Python"], technologies: [] };
const proposal: Proposal = { id: "proposal-test", task_id: task.id, team_id: team.id, idea: "Анализ отзывов", plan: "Подготовим таблицу", deadline: "14 дней",
  prototype_url: null, status: "pending", created_at: "", milestone_confirmed: false, points: 0, review: null };
beforeEach(() => setLocale("ru"));
afterEach(() => vi.resetAllMocks());

it("keeps low-score tasks visible, filters Other, trims search, and resets empty results", async () => {
  const user = userEvent.setup();
  render(<CatalogPage tasks={[task]} proposals={[]} mine={false} role="business" onOpen={vi.fn()} onCreate={vi.fn()} />);
  expect(screen.getAllByRole("button", { name: "Создать задачу" })).toHaveLength(1);
  expect(screen.getByRole("button", { name: /Отзывы кофейни/ })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Другое" }));
  expect(screen.getByRole("button", { name: "Другое" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.change(screen.getByLabelText("Поиск задач"), { target: { value: "  кофейни  " } });
  expect(screen.getByRole("status")).toHaveTextContent("Показано: 1 из 1");
  fireEvent.change(screen.getByLabelText("Поиск задач"), { target: { value: "Нет совпадений" } });
  expect(screen.getByRole("heading", { name: "По этим условиям задач нет" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
  expect(screen.getByRole("status")).toHaveTextContent("Показано: 1 из 1");
});

it("localizes marketplace fields without translating or losing the proposal draft", async () => {
  render(<DetailPage task={task} teams={[team]} proposals={[]} role="team" onBack={vi.fn()} onEdit={vi.fn()} onRefresh={vi.fn()} notify={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Идея решения"), { target: { value: "Сделаем отчёт на русском" } });
  act(() => setLocale("kk"));
  expect(screen.getByLabelText("Шешім идеясы")).toHaveValue("Сделаем отчёт на русском");
  expect(screen.getByRole("heading", { name: task.card.title! })).toBeVisible();
  expect(screen.getByRole("button", { name: "Тапсырмалар каталогы" })).toBeVisible();
});

it("retains failed proposal input and distinguishes successful save from refresh failure", async () => {
  const user = userEvent.setup();
  const refresh = vi.fn().mockRejectedValue(new Error("Refresh failed"));
  vi.mocked(api.createProposal).mockRejectedValueOnce(new ApiError("NETWORK_ERROR")).mockResolvedValueOnce(proposal);
  render(<DetailPage task={task} teams={[team]} proposals={[]} role="team" onBack={vi.fn()} onEdit={vi.fn()} onRefresh={refresh} notify={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Идея решения"), { target: { value: proposal.idea } });
  fireEvent.change(screen.getByLabelText("Короткий план"), { target: { value: proposal.plan } });
  fireEvent.change(screen.getByLabelText("Предполагаемый срок"), { target: { value: proposal.deadline } });
  await user.click(screen.getByRole("button", { name: "Отправить предложение" }));
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.getByLabelText("Идея решения")).toHaveValue(proposal.idea);
  await user.click(screen.getByRole("button", { name: "Отправить предложение" }));
  expect(screen.getByText(/Изменения сохранены/)).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Отправить предложение" })).not.toBeInTheDocument();
  expect(screen.getByRole("article")).toHaveTextContent(proposal.idea);
  await user.click(screen.getByRole("button", { name: "Обновить список" }));
  expect(api.createProposal).toHaveBeenCalledTimes(2);
});

it("keeps the accepted decision after a refresh error without changing another proposal", async () => {
  const user = userEvent.setup();
  const second = { ...proposal, id: "proposal-second" };
  vi.mocked(api.decideProposal).mockResolvedValueOnce({ ...proposal, status: "accepted" });
  render(<ProposalsPage proposals={[proposal, second]} teams={[team]} tasks={[task]} role="business"
    onRefresh={vi.fn().mockRejectedValue(new Error("Refresh failed"))} onOpen={vi.fn()} notify={vi.fn()} />);
  const cards = screen.getAllByRole("article");
  await user.click(within(cards[0]).getByRole("button", { name: "Выбрать команду" }));
  expect(within(cards[0]).getByText("Команда выбрана")).toBeVisible();
  expect(within(cards[0]).queryByRole("button", { name: "Отклонить" })).not.toBeInTheDocument();
  expect(within(cards[1]).getByRole("button", { name: "Выбрать команду" })).toBeEnabled();
  expect(screen.getByText(/Изменения сохранены/)).toBeVisible();
  expect(api.decideProposal).toHaveBeenCalledTimes(1);
});
