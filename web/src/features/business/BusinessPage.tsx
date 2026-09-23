import { useEffect, useRef } from "react";
import type { CardField, Category, Task } from "../../../../contracts/types";
import { useLocale } from "../../shared/i18n";
import { errorMessage } from "../../shared/http";
import { useBusinessCopy } from "./locales";
import { useBusinessForm, type BusinessStep } from "./useBusinessForm";
import TaskEditor from "./TaskEditor";
import RatingPanel from "./RatingPanel";
import "./business.css";

const steps: BusinessStep[] = ["description", "questions", "card", "review", "saved"];

export default function BusinessPage({ existing, onDone, onCancel, onSaved, onBusyChange }: {
  existing?: Task; onDone: (task: Task) => void; onCancel: () => void; onSaved?: (task: Task) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const form = useBusinessForm(existing);
  const copy = useBusinessCopy();
  const { locale } = useLocale();
  const heading = useRef<HTMLHeadingElement>(null);
  const focusField = useRef<CardField | null>(null);
  const question = form.questions[form.questionIndex];
  const aiMode = form.step === "questions" ? form.questionMode : form.ai?.mode;
  const published = form.saved?.status === "published";
  const titleReady = (form.card.title ?? "").trim().length >= 3;
  const stepIndex = steps.indexOf(form.step);

  useEffect(() => {
    onBusyChange?.(form.busy);
    return () => onBusyChange?.(false);
  }, [form.busy, onBusyChange]);

  useEffect(() => {
    if (!form.busy) return;
    const preventDeparture = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventDeparture);
    return () => window.removeEventListener("beforeunload", preventDeparture);
  }, [form.busy]);

  useEffect(() => {
    const target = focusField.current && document.getElementById(`card-${focusField.current}`);
    if (target) target.focus();
    else heading.current?.focus({ preventScroll: true });
    focusField.current = null;
  }, [form.step, form.questionIndex, published]);

  useEffect(() => {
    if (form.saved) onSaved?.(form.saved);
  }, [form.saved, onSaved]);

  function improve(field: CardField) {
    if (form.step === "card") document.getElementById(`card-${field}`)?.focus();
    else { focusField.current = field; form.go("card"); }
  }

  const rating = (
    <RatingPanel rating={form.ratingPending ? null : form.rating} preview
      pending={form.ratingPending} error={Boolean(form.ratingError)}
      onRetry={form.retryRating} onImprove={improve} />
  );

  return (
    <div className="business-page">
      <button className="text-button back" disabled={form.busy} onClick={onCancel}>{copy.backToTasks}</button>
      <header className="page-heading">
        <div><h1>{copy.title}</h1><p>{copy.intro}</p></div>
      </header>
      <ol className="business-steps" aria-label={copy.title}>
        {copy.steps.map((label, index) => (
          <li key={steps[index]} aria-current={index === stepIndex ? "step" : undefined}>
            <span aria-hidden="true">{index + 1}</span>{label}
          </li>
        ))}
      </ol>
      {form.error && <div className="error-box" role="alert">{errorMessage(form.error, locale)}</div>}
      {form.ai && form.step !== "description" && form.step !== "saved" && (
        <div className="notice ai-notice">
          <strong>{aiMode === "live" ? copy.aiLive : copy.aiDemo}</strong>
          <span>{aiMode === "live" ? copy.aiLiveHint : copy.aiDemoHint}</span>
          {locale !== form.responseLocale && <span>{copy.sourceLanguage}</span>}
          {form.warnings.length > 0 && (
            <ul className="ai-warnings" aria-label={copy.aiWarnings}>
              {form.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
            </ul>
          )}
        </div>
      )}

      <section className="panel business-stage" aria-busy={form.busy}>
        {form.step === "description" && (
          <form onSubmit={(event) => { event.preventDefault(); void form.clarify(); }}>
            <fieldset disabled={form.busy}>
              <h2 ref={heading} tabIndex={-1}>{copy.steps[0]}</h2>
              <label htmlFor="business-description"><span id="description-label">{copy.description}</span>
                <textarea id="business-description" rows={6} value={form.description} required
                  minLength={5} maxLength={6000} aria-describedby="description-hint" aria-labelledby="description-label"
                  placeholder={copy.descriptionPlaceholder}
                  onChange={(event) => form.setDescription(event.target.value)} />
                <small className="field-hint" id="description-hint">{copy.descriptionHint}</small>
              </label>
              <div className="input-meta">
                {!form.description && <button type="button" className="text-button"
                  onClick={() => form.setDescription(copy.exampleText)}>{copy.example}</button>}
                <span>{form.description.length}/6000</span>
              </div>
              <label htmlFor="business-category"><span>{copy.category}</span>
                <select id="business-category" value={form.category}
                  onChange={(event) => form.setCategory(event.target.value as Category)}>
                  {Object.entries(copy.categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <div className="form-actions">
                <button className="button primary" type="submit" disabled={form.description.trim().length < 5}>
                  {form.busy ? copy.clarifying : copy.clarify}
                </button>
              </div>
            </fieldset>
          </form>
        )}

        {form.step === "questions" && question && (
          <form onSubmit={(event) => {
            event.preventDefault();
            if (!form.answers[question.id]?.trim()) return;
            if (form.questionIndex < form.questions.length - 1) form.setQuestionIndex(form.questionIndex + 1);
            else void form.compose();
          }}>
            <fieldset disabled={form.busy}>
              <p className="muted">{copy.question} {form.questionIndex + 1} / {form.questions.length}</p>
              <h2 ref={heading} tabIndex={-1} id="question-heading">
                {question.text}
              </h2>
              <p id="question-purpose" className="question-purpose">
                <strong>{copy.why}: </strong>{question.fields.map((field) => copy.reasons[field]).join(" ")}
              </p>
              <label htmlFor="business-answer"><span id="answer-label">{copy.answer}</span>
                <textarea id="business-answer" rows={5} required maxLength={6000}
                  aria-describedby="question-heading question-purpose answer-hint" aria-labelledby="answer-label"
                  value={form.answers[question.id] ?? ""}
                  onChange={(event) => form.setAnswers({ ...form.answers, [question.id]: event.target.value })} />
                <small className="field-hint" id="answer-hint">{copy.questionHint}</small>
              </label>
              <div className="form-actions">
                <button type="button" className="button secondary" onClick={() => {
                  if (form.questionIndex) form.setQuestionIndex(form.questionIndex - 1);
                  else form.go("description");
                }}>{copy.back}</button>
                <button type="submit" className="button primary" disabled={!form.answers[question.id]?.trim()}>
                  {form.busy ? copy.composing : form.questionIndex === form.questions.length - 1 ? copy.compose : copy.next}
                </button>
              </div>
            </fieldset>
          </form>
        )}

        {form.step === "card" && (
          <>
            <h2 ref={heading} tabIndex={-1}>{copy.card}</h2><p className="muted">{copy.cardHint}</p>
            <TaskEditor card={form.card} onChange={form.changeCard} />
            {rating}
            <div className="form-actions">
              {form.questions.length > 0 && <button className="button secondary" onClick={() => form.go("questions")}>{copy.back}</button>}
              <button className="button primary" onClick={() => form.go("review")}>{copy.review}</button>
            </div>
          </>
        )}

        {form.step === "review" && (
          <fieldset disabled={form.busy}>
            <h2 ref={heading} tabIndex={-1}>{copy.steps[3]}</h2>
            <p>{copy.reviewHint}</p>
            <p className="review-title">{form.card.title || copy.titleRequired}</p>
            {rating}
            <label className="confirmation" htmlFor="business-confirmation">
              <input id="business-confirmation" type="checkbox" checked={form.confirmed}
                aria-describedby="confirmation-hint" onChange={(event) => form.setConfirmed(event.target.checked)} />
              <span>{copy.confirmation}</span>
            </label>
            <p id="confirmation-hint" className="small muted">{copy.pendingHint}</p>
            <div className="form-actions">
              <button className="button secondary" onClick={() => form.go("card")}>{copy.edit}</button>
              <button className="button primary" disabled={!form.confirmed} onClick={() => void form.save()}>
                {form.busy ? copy.saving : copy.save}
              </button>
            </div>
          </fieldset>
        )}

        {form.step === "saved" && form.saved && (
          <fieldset disabled={form.busy}>
            <h2 ref={heading} tabIndex={-1} role="status">{published ? copy.published : copy.saved}</h2>
            <p>{published ? copy.publishedHint : copy.savedHint}</p>
            <p className="review-title">{form.saved.card.title}</p>
            {!published && !titleReady && <p className="notice">{copy.titleRequired}</p>}
            <div className="form-actions">
              {published ? <button className="button primary" onClick={() => onDone(form.saved!)}>{copy.view}</button> : (
                <button className="button primary" disabled={!form.confirmed || !form.saved.confirmed || !titleReady}
                  onClick={() => void form.publish()}>{form.busy ? copy.publishing : copy.publish}</button>
              )}
              {!published && <button className="button secondary" onClick={() => form.go("card")}>{copy.edit}</button>}
              {!published && <button className="text-button" onClick={() => onDone(form.saved!)}>{copy.view}</button>}
            </div>
          </fieldset>
        )}
      </section>
    </div>
  );
}
