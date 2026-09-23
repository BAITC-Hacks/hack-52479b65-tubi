import type { CardField, Rating } from "../../../../contracts/types";
import { useBusinessCopy } from "./locales";
import { getNextImprovement } from "./ratingAdvice";

export function ScoreRing({ score, size = 50 }: { score: number; size?: number }) {
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 60 60" aria-hidden="true">
        <circle cx="30" cy="30" r="25" className="ring-track" />
        <circle cx="30" cy="30" r="25" className="ring-value" strokeDasharray={`${Math.max(0, Math.min(score, 100)) * 1.571} 157.1`} />
      </svg>
      <span>{score}</span>
    </div>
  );
}

export default function RatingPanel({ rating, preview = false, pending = false, error = false, onRetry, onImprove }: {
  rating: Rating | null; preview?: boolean; pending?: boolean; error?: boolean;
  onRetry?: () => void; onImprove?: (field: CardField) => void;
}) {
  const copy = useBusinessCopy();
  const advice = rating ? getNextImprovement(rating) : null;
  return (
    <aside className="rating-panel panel" aria-label={copy.readiness}>
      <h3>{preview ? copy.preview : copy.readiness}</h3>
      <div role="status" aria-live="polite">
        {error ? <p>{copy.ratingUnavailable}</p> : pending || !rating ? <p>{copy.calculating}</p> : (
          <p className="rating-score"><strong>{rating.score} / 100</strong> · {copy.levels[rating.level]}</p>
        )}
      </div>
      {error && onRetry && <button className="text-button" onClick={onRetry}>{copy.retry}</button>}
      {rating && !pending && !error && (
        <>
          <dl className="rating-breakdown">
            {rating.breakdown.map((item) => (
              <div key={item.key}><dt>{copy.ratingLabels[item.key] ?? item.key}</dt><dd>{item.earned} / {item.max}</dd></div>
            ))}
          </dl>
          <div className="rating-advice">
            <h4>{advice ? copy.nextImprovement : copy.complete}</h4>
            {advice ? (
              <>
                <p>{copy.add} «{advice.fields.map((field) => copy.labels[field]).join(", ")}»
                  {advice.remaining > 0 && ` — ${copy.improvement.replace("{points}", String(advice.remaining))}`}.
                </p>
                {onImprove && <button className="text-button" onClick={() => onImprove(advice.fields[0])}>{copy.improve}</button>}
              </>
            ) : <p>{copy.allFields}</p>}
          </div>
        </>
      )}
    </aside>
  );
}
