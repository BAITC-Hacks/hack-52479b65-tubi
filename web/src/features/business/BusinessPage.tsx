import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  LoaderCircle,
  Save,
  Send,
  Sparkles,
} from "lucide-react";
import type {
  AIResponse,
  Card,
  Category,
  Rating,
  Task,
} from "../../../../contracts/types";
import { categories, emptyCard } from "../../shared/constants";
import { evaluateTask, prepareTask, publishTask, saveTask } from "./api";
import TaskEditor from "./TaskEditor";
import RatingPanel from "./RatingPanel";
import "./business.css";

export default function BusinessPage({
  existing,
  onDone,
  onCancel,
}: {
  existing?: Task;
  onDone: (task: Task) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(existing ? 2 : 0);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("analytics");
  const [prepared, setPrepared] = useState<AIResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [card, setCard] = useState<Card>(existing?.card || { ...emptyCard });
  const [rating, setRating] = useState<Rating | null>(existing?.rating || null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ratingError, setRatingError] = useState("");
  const savedId = useRef(existing?.id);

  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    const timer = setTimeout(
      () =>
        evaluateTask(card)
          .then((data) => {
            if (!cancelled) {
              setRating(data);
              setRatingError("");
            }
          })
          .catch((e) => {
            if (!cancelled) setRatingError(e.message);
          }),
      250,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [card, step]);

  async function prepare(stage: "clarify" | "compose") {
    setBusy(true);
    setError("");
    try {
      const result = await prepareTask({
        stage,
        category,
        description,
        answers:
          stage === "compose"
            ? (prepared?.questions || []).map((q) => ({
                question_id: q.id,
                fields: q.fields,
                question: q.text,
                answer: answers[q.id] || "",
              }))
            : [],
      });
      setPrepared(result);
      setCard(result.card);
      setConfirmed(false);
      setStep(stage === "clarify" ? 1 : 2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finish(publish: boolean) {
    setBusy(true);
    setError("");
    try {
      let task = await saveTask(card, savedId.current);
      savedId.current = task.id;
      if (publish) task = await publishTask(task.id);
      onDone(task);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="business-page page-enter">
      <button className="text-button back" onClick={onCancel}>
        <ArrowLeft size={16} /> К задачам
      </button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">КОНСТРУКТОР ЗАДАЧИ</div>
          <h1>
            {existing
              ? "Сделаем задачу понятнее"
              : "От идеи — к первому решению"}
          </h1>
          <p>
            Расскажите о своей задаче. Мы поможем собрать всё, что нужно
            команде.
          </p>
        </div>
      </div>
      <div className="stepper">
        {["Описание", "Уточнения", "Карточка и рейтинг"].map((label, i) => (
          <div
            key={label}
            className={i === step ? "active" : i < step ? "complete" : ""}
          >
            <span>{i < step ? <Check size={14} /> : i + 1}</span>
            {label}
          </div>
        ))}
      </div>
      {error && (
        <div role="alert" className="error-box">
          {error}
        </div>
      )}
      {step === 0 && (
        <div className="compose-layout">
          <section className="panel description-panel">
            <div className="section-heading">
              <div className="icon-tile violet">
                <FileText size={21} />
              </div>
              <div>
                <h2>С чего начнём?</h2>
                <p>Можно своими словами. Даже если идея пока сырая.</p>
              </div>
            </div>
            <label>
              <span>Ваша задача</span>
              <textarea
                rows={7}
                value={description}
                maxLength={6000}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Например: мы получаем много отзывов и хотим быстрее понимать, на что жалуются клиенты…"
              />
            </label>
            <div className="input-meta">
              <button
                className="text-button"
                onClick={() =>
                  setDescription(
                    "Мы вручную читаем отзывы гостей кофейни и хотим быстрее находить повторяющиеся проблемы.",
                  )
                }
              >
                Попробовать пример
              </button>
              <span>{description.length}/6000</span>
            </div>
            <label>
              <span>Направление задачи</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                {Object.entries(categories).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button
                className="button primary"
                disabled={busy || description.trim().length < 5}
                onClick={() => prepare("clarify")}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Sparkles size={17} />
                )}{" "}
                {busy ? "Готовим вопросы…" : "Помочь сформулировать"}
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
          <aside className="helper-panel">
            <span className="hero-kicker">
              <Sparkles size={15} /> ХОРОШАЯ ЗАДАЧА — ПОЛОВИНА РЕШЕНИЯ
            </span>
            <h3>
              Чем понятнее задача,
              <br />
              тем легче найти команду.
            </h3>
            <p>
              Ответьте на вопросы, проверьте карточку и добавьте детали. Каждое
              уточнение помогает студентам начать работу.
            </p>
            <div className="helper-list">
              <span>
                01 <b>Опишите свою потребность</b>
              </span>
              <span>
                02 <b>Добавьте важные детали</b>
              </span>
              <span>
                03 <b>Получите предложения команд</b>
              </span>
            </div>
            <p className="small">
              Все сведения перед публикацией подтверждаете вы.
            </p>
          </aside>
        </div>
      )}
      {step === 1 && prepared && (
        <section className="panel questions-panel">
          <div className="section-heading">
            <div className="icon-tile violet">
              <Sparkles size={22} />
            </div>
            <div>
              <h2>Несколько вопросов по существу</h2>
              <p>
                Ответы станут основой карточки. Если пока не знаете — так и
                напишите.
              </p>
            </div>
          </div>
          {prepared.warnings.map((w) => (
            <div className="notice" key={w}>
              {w}
            </div>
          ))}
          {prepared.questions.map((q, i) => (
            <label className="question-label" key={q.id}>
              <span>
                <b>{String(i + 1).padStart(2, "0")}</b>
                {q.text}
              </span>
              <textarea
                rows={3}
                value={answers[q.id] || ""}
                maxLength={6000}
                onChange={(e) =>
                  setAnswers({ ...answers, [q.id]: e.target.value })
                }
                placeholder="Ваш ответ…"
              />
            </label>
          ))}
          <div className="form-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setStep(0)}
            >
              Назад
            </button>
            <button
              className="button primary"
              disabled={
                busy ||
                prepared.questions.some((q) => !(answers[q.id] || "").trim())
              }
              onClick={() => prepare("compose")}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <FileText size={17} />
              )}{" "}
              {busy ? "Собираем карточку…" : "Собрать карточку"}
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}
      {step === 2 && (
        <div className="editor-layout">
          <section className="panel">
            <div className="section-heading">
              <div className="icon-tile violet">
                <FileText size={22} />
              </div>
              <div>
                <h2>Карточка вашей задачи</h2>
                <p>
                  Проверьте текст и заполните то, что пока осталось неизвестным.
                </p>
              </div>
            </div>
            {prepared?.warnings.map((w) => (
              <div className="notice" key={w}>
                {w}
              </div>
            ))}
            <TaskEditor
              card={card}
              onChange={(next) => {
                setCard(next);
                setConfirmed(false);
              }}
            />
            <label className="confirmation">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>
                Я проверил(а) карточку и подтверждаю указанные сведения.
              </span>
            </label>
            <div className="form-actions">
              <button
                className="button secondary"
                disabled={busy || !confirmed}
                onClick={() => finish(false)}
              >
                <Save size={16} /> Сохранить
              </button>
              <button
                className="button primary"
                disabled={
                  busy || !confirmed || (card.title || "").trim().length < 3
                }
                onClick={() => finish(true)}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Send size={17} />
                )}{" "}
                {busy
                  ? "Сохраняем…"
                  : existing?.status === "published"
                    ? "Обновить в каталоге"
                    : "Опубликовать задачу"}
              </button>
            </div>
          </section>
          <div>
            {ratingError && (
              <div className="error-box" role="alert">
                {ratingError}
              </div>
            )}
            <RatingPanel rating={rating} preview />
          </div>
        </div>
      )}
    </div>
  );
}
