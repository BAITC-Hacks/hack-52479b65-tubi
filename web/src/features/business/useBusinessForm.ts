import { useEffect, useRef, useState } from "react";
import type { AIResponse, Card, Category, Question, Rating, Task } from "../../../../contracts/types";
import { emptyCard } from "../../shared/constants";
import { evaluateTask, prepareTask, publishTask, saveTask } from "./api";

export type BusinessStep = "description" | "questions" | "card" | "review" | "saved";

export function useBusinessForm(existing?: Task) {
  const [step, setStep] = useState<BusinessStep>(existing ? "card" : "description");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>(existing?.card.category ?? "analytics");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ai, setAi] = useState<AIResponse | null>(null);
  const [questionMode, setQuestionMode] = useState<AIResponse["mode"]>("fallback");
  const [card, setCard] = useState<Card>(existing?.card ?? { ...emptyCard });
  const [rating, setRating] = useState<Rating | null>(existing?.rating ?? null);
  const [ratingPending, setRatingPending] = useState(false);
  const [ratingError, setRatingError] = useState<Error | null>(null);
  const [retry, setRetry] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [saved, setSaved] = useState<Task | null>(null);
  const savedId = useRef(existing?.id);
  const operation = useRef(false);
  const ratingVersion = useRef(0);
  const clarifiedInput = useRef("");
  const composedInput = useRef("");
  const mounted = useRef(true);
  const evaluating = step === "card" || step === "review";

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const version = ++ratingVersion.current;
    if (!evaluating) return;
    const controller = new AbortController();
    setRatingPending(true);
    const timer = setTimeout(() => {
      evaluateTask(card, controller.signal).then((next) => {
        if (version !== ratingVersion.current || controller.signal.aborted) return;
        setRating(next);
        setRatingError(null);
      }).catch((cause: Error) => {
        if (version !== ratingVersion.current || controller.signal.aborted) return;
        setRating(null);
        setRatingError(cause);
      }).finally(() => {
        if (version === ratingVersion.current && !controller.signal.aborted) setRatingPending(false);
      });
    }, 250);
    return () => {
      ++ratingVersion.current;
      clearTimeout(timer);
      controller.abort();
    };
  }, [card, evaluating, retry]);

  function changeCard(next: Card) {
    ++ratingVersion.current; // Invalidate a response immediately, before the next effect.
    setCard(next);
    setConfirmed(false);
    setRating(null);
    setRatingPending(true);
    setRatingError(null);
    setSaved(null);
  }

  async function run(action: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError(null);
    try { await action(); }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause : new Error(String(cause))); }
    finally {
      operation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  function go(next: BusinessStep) {
    if (operation.current) return;
    setError(null);
    setStep(next);
  }

  async function clarify() {
    if (description.trim().length < 5 || description.length > 6000) return;
    const input = JSON.stringify([description, category]);
    if (clarifiedInput.current === input && questions.length) {
      go("questions");
      return;
    }
    await run(async () => {
      const result = await prepareTask({ stage: "clarify", category, description, answers: [] });
      if (!mounted.current) return;
      // Keep old answers even when the user revisits the description.
      setAnswers((old) => {
        const next = { ...old };
        result.questions.forEach((question) => {
          if (next[question.id] !== undefined) return;
          const previous = questions.find((q) => q.fields.join() === question.fields.join());
          if (previous) next[question.id] = old[previous.id] ?? "";
        });
        return next;
      });
      setQuestions(result.questions);
      setQuestionMode(result.mode);
      setQuestionIndex(0);
      setAi(result);
      clarifiedInput.current = input;
      setConfirmed(false);
      setStep("questions");
    });
  }

  async function compose() {
    if (questions.some((q) => !answers[q.id]?.trim())) return;
    const input = { stage: "compose" as const, description, category, answers: questions.map((q) => ({
      question_id: q.id, fields: q.fields, question: q.text, answer: answers[q.id] ?? "",
    })) };
    const signature = JSON.stringify(input);
    if (composedInput.current === signature) { go("card"); return; }
    await run(async () => {
      const result = await prepareTask(input);
      if (!mounted.current) return;
      setAi(result);
      changeCard(result.card);
      composedInput.current = signature;
      setStep("card");
    });
  }

  async function save() {
    if (!confirmed || operation.current) return;
    await run(async () => {
      const task = await saveTask(card, savedId.current);
      if (!mounted.current) return;
      savedId.current = task.id;
      setSaved(task);
      setCard(task.card);
      setRating(task.rating);
      setStep("saved");
    });
  }

  async function publish() {
    if (!confirmed || !saved?.confirmed || (card.title ?? "").trim().length < 3 || operation.current) return;
    await run(async () => {
      const task = await publishTask(saved.id);
      if (mounted.current) setSaved(task);
    });
  }

  return {
    step, go, description, setDescription, category, setCategory,
    questions, questionIndex, setQuestionIndex, answers, setAnswers, ai, questionMode,
    card, changeCard, rating, ratingPending, ratingError, retryRating: () => setRetry((n) => n + 1),
    confirmed, setConfirmed, busy, error, saved, clarify, compose, save, publish,
  };
}
