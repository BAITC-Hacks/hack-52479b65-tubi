import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AIResponse, Rating, Task } from "../../../../contracts/types";
import { emptyCard } from "../../shared/constants";
import { setLocale } from "../../shared/i18n";
import LocaleSelect from "../../shared/i18n/LocaleSelect";
import { ApiError } from "../../shared/http";
import * as api from "./api";
import BusinessPage from "./BusinessPage";

vi.mock("./api");
const rating: Rating = {
  score: 35, level: "working",
  breakdown: [{ key: "success_criteria", earned: 0, max: 15 }],
  improvements: [{ fields: ["success_criteria"], message: "Добавьте критерии успеха" }],
};
const task: Task = {
  id: "task-ui", card: { ...emptyCard, title: "Отзывы гостей" }, rating, confirmed: true,
  status: "draft", created_at: "", updated_at: "",
};
const prepared: AIResponse = {
  mode: "fallback", card: task.card, missing_fields: [], warnings: [],
  questions: [
    { id: "need", fields: ["need"], text: "Что изменить?" },
    { id: "data", fields: ["data"], text: "Какие данные?" },
    { id: "result", fields: ["expected_result"], text: "Какой результат?" },
  ],
};
function setup(existing?: Task) {
  const onDone = vi.fn();
  render(<><LocaleSelect /><BusinessPage existing={existing} onDone={onDone} onCancel={vi.fn()} /></>);
  return { user: userEvent.setup(), onDone };
}

describe("business screens", () => {
  beforeEach(() => {
    setLocale("ru");
    vi.mocked(api.prepareTask).mockResolvedValue(prepared);
    vi.mocked(api.evaluateTask).mockResolvedValue(rating);
    vi.mocked(api.saveTask).mockResolvedValue(task);
    vi.mocked(api.publishTask).mockResolvedValue({ ...task, status: "published" });
  });
  afterEach(() => vi.resetAllMocks());

  it("blocks blank descriptions and moves keyboard focus to the labeled input", async () => {
    const { user } = setup();
    expect(screen.getByRole("heading", { name: "Описание" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Ваша задача" })).toHaveFocus();
    await user.type(screen.getByRole("textbox", { name: "Ваша задача" }), "   ");
    expect(screen.getByRole("button", { name: "Перейти к вопросам" })).toBeDisabled();
    expect(api.prepareTask).not.toHaveBeenCalled();
  });

  it("keeps input and focus across all three interface languages", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("textbox", { name: "Ваша задача" }), "Отзывы нашей кофейни");
    await user.selectOptions(screen.getByRole("combobox", { name: "Язык интерфейса" }), "kk");
    expect(screen.getByRole("textbox", { name: "Сіздің тапсырмаңыз" })).toHaveValue("Отзывы нашей кофейни");
    expect(localStorage.getItem("tubi.locale")).toBe("kk");
    expect(document.documentElement.lang).toBe("kk");
    await user.selectOptions(screen.getByRole("combobox", { name: "Интерфейс тілі" }), "en");
    expect(screen.getByRole("textbox", { name: "Your task" })).toHaveValue("Отзывы нашей кофейни");
    expect(screen.getByRole("combobox", { name: "Interface language" })).toHaveFocus();
  });

  it("shows one question at a time and retains answers after an API error", async () => {
    const { user } = setup();
    fireEvent.change(screen.getByRole("textbox", { name: "Ваша задача" }), { target: { value: "Отзывы нашей кофейни" } });
    await user.click(screen.getByRole("button", { name: "Перейти к вопросам" }));
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Что именно вы хотите изменить или улучшить?" })).toHaveFocus();
    expect(screen.getByText(/Команда сосредоточится/)).toBeVisible();
    await user.type(screen.getByLabelText("Ваш ответ"), "Находить жалобы");
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.type(screen.getByLabelText("Ваш ответ"), "Таблица CSV");
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.type(screen.getByLabelText("Ваш ответ"), "Отчёт по жалобам");
    vi.mocked(api.prepareTask).mockRejectedValueOnce(new ApiError("NETWORK_ERROR"));
    await user.click(screen.getByRole("button", { name: "Собрать карточку" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Ваши данные сохранены в форме");
    expect(screen.getByLabelText("Ваш ответ")).toHaveValue("Отчёт по жалобам");
    await user.click(screen.getByRole("button", { name: "Назад" }));
    expect(screen.getByLabelText("Ваш ответ")).toHaveValue("Таблица CSV");
    await user.selectOptions(screen.getByRole("combobox", { name: "Язык интерфейса" }), "en");
    expect(screen.getByLabelText("Your answer")).toHaveValue("Таблица CSV");
  });

  it("requires confirmation, clears it after editing, and publishes only after saving", async () => {
    const { user, onDone } = setup(task);
    await user.click(screen.getByRole("button", { name: "Проверить рейтинг и подтвердить" }));
    expect(screen.getByRole("button", { name: "Подтвердить и сохранить" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Опубликовать задачу" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Вернуться к редактированию" }));
    await user.type(screen.getByLabelText("Название задачи"), " — уточнение");
    await user.click(screen.getByRole("button", { name: "Проверить рейтинг и подтвердить" }));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Подтвердить и сохранить" }));
    expect(screen.getByRole("status")).toHaveTextContent("Карточка сохранена");
    expect(api.publishTask).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Опубликовать задачу" }));
    expect(screen.getByRole("status")).toHaveTextContent("Задача доступна командам");
    expect(api.publishTask).toHaveBeenCalledWith(task.id);
    expect(onDone).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Открыть задачу" }));
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ status: "published" }));
  });

  it("uses server points and focuses the suggested field from review", async () => {
    const { user } = setup(task);
    await user.click(screen.getByRole("button", { name: "Проверить рейтинг и подтвердить" }));
    await waitFor(() => expect(screen.getByText(/это может дать ещё 15 баллов/)).toBeVisible());
    await user.click(screen.getByRole("button", { name: "Дополнить поле" }));
    expect(screen.getByLabelText("Критерии успеха")).toHaveFocus();
  });

  it("keeps user card text and confirmation when the language alone changes", async () => {
    const { user } = setup(task);
    await user.type(screen.getByLabelText("Данные и материалы"), "Кесте CSV");
    await user.click(screen.getByRole("button", { name: "Проверить рейтинг и подтвердить" }));
    await user.click(screen.getByRole("checkbox"));
    await user.selectOptions(screen.getByRole("combobox", { name: "Язык интерфейса" }), "kk");
    expect(screen.getByRole("checkbox")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Өңдеуге оралу" }));
    expect(screen.getByLabelText("Деректер мен материалдар")).toHaveValue("Кесте CSV");
  });

  it("distinguishes a live response from the demo and preserves the server question", async () => {
    vi.mocked(api.prepareTask).mockResolvedValueOnce({ ...prepared, mode: "live" });
    const { user } = setup();
    act(() => setLocale("en"));
    fireEvent.change(screen.getByLabelText("Your task"), { target: { value: "Отзывы нашей кофейни" } });
    await user.click(screen.getByRole("button", { name: "Continue to questions" }));
    expect(screen.getByText("Response prepared by AI")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Что изменить?" })).toBeVisible();
    expect(screen.getByText("The server response is shown in the language it was received in.")).toBeVisible();
  });
});
