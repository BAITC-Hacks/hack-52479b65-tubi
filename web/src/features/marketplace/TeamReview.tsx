import { useId, useState, type FormEvent } from "react";
import type { Proposal } from "../../../../contracts/types";
import { errorMessage } from "../../shared/http";
import { useLocale } from "../../shared/i18n";
import { submitTeamReview } from "./api";
import { reviewMessages } from "./locales/review";

type Props = {
  proposal: Proposal;
  role: "business" | "team";
  onRefresh: () => Promise<void>;
};

export default function TeamReview({ proposal, role, onRefresh }: Props) {
  const { locale } = useLocale();
  const copy = reviewMessages[locale];
  const id = useId();
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshError, setRefreshError] = useState<Error | null>(null);
  const [saved, setSaved] = useState<{ proposalId: string; review: Proposal["review"] } | null>(null);
  const review = proposal.review ?? (saved?.proposalId === proposal.id ? saved.review : null);
  const allowed = role === "business" && proposal.status === "accepted" && proposal.milestone_confirmed;
  const valid = /^[1-5]$/.test(rating) && comment.trim().length > 0 && comment.length <= 2000;

  async function refresh() {
    setRefreshError(null);
    setBusy(true);
    try { await onRefresh(); }
    catch (cause) { setRefreshError(cause instanceof Error ? cause : new Error()); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allowed || !valid || busy || review) return;
    setError(null);
    setBusy(true);
    try {
      const updated = await submitTeamReview(proposal.id, { rating: Number(rating), comment: comment.trim() });
      if (!updated.review) throw new Error("Missing saved review");
      setSaved({ proposalId: proposal.id, review: updated.review });
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error());
      setBusy(false);
      return;
    }
    await refresh();
  }

  if (!review && !allowed) return null;

  return <section className="notice" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>{copy.title}</h3>
    {review ? <>
      {saved?.proposalId === proposal.id && <p role="status">{copy.saved}</p>}
      <p><strong>{copy.rating}: {review.rating} {copy.outOfFive}</strong></p>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{review.comment}</p>
      {refreshError && <div className="error-box" role="alert">
        <p>{copy.refreshFailed}</p>
        <p>{errorMessage(refreshError, locale)}</p>
        <button type="button" className="button secondary" disabled={busy} onClick={() => void refresh()}>{copy.retry}</button>
      </div>}
    </> : <form onSubmit={(event) => void submit(event)}>
      <p className="small muted" id={`${id}-hint`}>{copy.hint}</p>
      {error && <p className="error-box" role="alert">{errorMessage(error, locale)}</p>}
      <fieldset disabled={busy} aria-busy={busy} aria-describedby={`${id}-hint`}>
        <label htmlFor={`${id}-rating`}><span>{copy.rating}</span>
          <select id={`${id}-rating`} value={rating} required onChange={(event) => setRating(event.target.value)}>
            <option value="">{copy.chooseRating}</option>
            {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} {copy.outOfFive}</option>)}
          </select>
        </label>
        <label htmlFor={`${id}-comment`}><span id={`${id}-comment-label`}>{copy.comment}</span>
          <textarea id={`${id}-comment`} rows={4} required maxLength={2000} value={comment}
            aria-labelledby={`${id}-comment-label`} aria-describedby={`${id}-comment-hint`}
            onChange={(event) => setComment(event.target.value)} />
          <small className="field-hint" id={`${id}-comment-hint`}>{copy.commentHint}</small>
        </label>
        <button type="submit" className="button primary" disabled={!valid || busy}>{busy ? copy.submitting : copy.submit}</button>
      </fieldset>
    </form>}
  </section>;
}
