import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Proposal } from "../../../../contracts/types";
import { ApiError } from "../../shared/http";
import { setLocale } from "../../shared/i18n";
import { submitTeamReview } from "./api";
import TeamReview from "./TeamReview";

vi.mock("./api", () => ({ submitTeamReview: vi.fn() }));

const proposal: Proposal = {
  id: "proposal-review", task_id: "task-review", team_id: "team-review", idea: "Прототип", plan: "Проверка",
  deadline: "Две недели", prototype_url: null, status: "accepted", created_at: "2026-09-23T10:00:00Z",
  milestone_confirmed: true, points: 50, review: null,
};
const savedReview = { rating: 4, comment: "Команда подготовила понятный прототип.", created_at: "2026-09-23T12:00:00Z" };

beforeEach(() => {
  vi.resetAllMocks();
  setLocale("ru");
  vi.mocked(submitTeamReview).mockResolvedValue({ ...proposal, review: savedReview });
});

describe("team review", () => {
  it("requires an explicit rating and a nonblank comment, with keyboard-accessible labels", async () => {
    const user = userEvent.setup();
    render(<TeamReview proposal={proposal} role="business" onRefresh={vi.fn()} />);
    const rating = screen.getByRole("combobox", { name: "Оценка работы" });
    expect(rating).toHaveValue("");
    expect(screen.getByRole("button", { name: "Опубликовать отзыв" })).toBeDisabled();
    await user.tab();
    expect(rating).toHaveFocus();
    await user.selectOptions(rating, "4");
    await user.tab();
    expect(screen.getByLabelText("Ваш отзыв")).toHaveFocus();
    await user.type(screen.getByLabelText("Ваш отзыв"), "   ");
    expect(screen.getByRole("button", { name: "Опубликовать отзыв" })).toBeDisabled();
    expect(screen.getByLabelText("Ваш отзыв")).toHaveAttribute("maxlength", "2000");
    expect(submitTeamReview).not.toHaveBeenCalled();
  });

  it.each([
    { role: "business" as const, status: "pending" as const, milestone_confirmed: false },
    { role: "business" as const, status: "rejected" as const, milestone_confirmed: false },
    { role: "business" as const, status: "accepted" as const, milestone_confirmed: false },
    { role: "team" as const, status: "accepted" as const, milestone_confirmed: true },
  ])("hides the form for $role / $status / completed=$milestone_confirmed", (state) => {
    const { container } = render(<TeamReview proposal={{ ...proposal, ...state }} role={state.role} onRefresh={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(["business", "team"] as const)("shows a saved review to %s without a second submission form", (role) => {
    render(<TeamReview proposal={{ ...proposal, review: savedReview }} role={role} onRefresh={vi.fn()} />);
    expect(screen.getByText(savedReview.comment)).toBeVisible();
    expect(screen.getByText("Оценка работы: 4 из 5")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("submits trimmed content and keeps the returned review when refreshing fails", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn().mockRejectedValueOnce(new ApiError("NETWORK_ERROR")).mockResolvedValue(undefined);
    render(<TeamReview proposal={proposal} role="business" onRefresh={refresh} />);
    await user.selectOptions(screen.getByLabelText("Оценка работы"), "4");
    fireEvent.change(screen.getByLabelText("Ваш отзыв"), { target: { value: `  ${savedReview.comment}  ` } });
    await user.click(screen.getByRole("button", { name: "Опубликовать отзыв" }));
    expect(submitTeamReview).toHaveBeenCalledExactlyOnceWith(proposal.id, { rating: 4, comment: savedReview.comment });
    expect(screen.getByRole("status")).toHaveTextContent("Отзыв сохранён.");
    expect(screen.getByText(savedReview.comment)).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Отзыв сохранён, но обновить список пока не удалось.");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Обновить список" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(submitTeamReview).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("preserves the chosen rating and comment after a failed save", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn();
    vi.mocked(submitTeamReview).mockRejectedValueOnce(new ApiError("NETWORK_ERROR"));
    render(<TeamReview proposal={proposal} role="business" onRefresh={refresh} />);
    await user.selectOptions(screen.getByLabelText("Оценка работы"), "3");
    await user.type(screen.getByLabelText("Ваш отзыв"), "Нужна более подробная документация.");
    await user.click(screen.getByRole("button", { name: "Опубликовать отзыв" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось связаться с сервером");
    expect(screen.getByLabelText("Оценка работы")).toHaveValue("3");
    expect(screen.getByLabelText("Ваш отзыв")).toHaveValue("Нужна более подробная документация.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("translates labels to Kazakh without changing the rating or user text", async () => {
    const user = userEvent.setup();
    render(<TeamReview proposal={proposal} role="business" onRefresh={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText("Оценка работы"), "2");
    await user.type(screen.getByLabelText("Ваш отзыв"), "Команда объяснила результат.");
    act(() => setLocale("kk"));
    expect(screen.getByRole("heading", { name: "Команда жұмысы туралы пікір" })).toBeVisible();
    expect(screen.getByLabelText("Жұмыс бағасы")).toHaveValue("2");
    expect(screen.getByLabelText("Сіздің пікіріңіз")).toHaveValue("Команда объяснила результат.");
    expect(screen.getByRole("button", { name: "Пікірді жариялау" })).toBeEnabled();
  });
});
