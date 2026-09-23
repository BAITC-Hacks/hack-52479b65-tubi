import { Check, Sparkles, TrendingUp } from "lucide-react";
import type { Rating } from "../../../../contracts/types";
import { levels, ratingLabels } from "../../shared/constants";

export function ScoreRing({
  score,
  size = 50,
}: {
  score: number;
  size?: number;
}) {
  return (
    <div
      className={`score-ring score-${score >= 70 ? "high" : score >= 40 ? "mid" : "low"}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 60 60" aria-hidden="true">
        <circle cx="30" cy="30" r="25" className="ring-track" />
        <circle
          cx="30"
          cy="30"
          r="25"
          className="ring-value"
          strokeDasharray={`${score * 1.571} 157.1`}
        />
      </svg>
      <span>{score}</span>
    </div>
  );
}

export default function RatingPanel({
  rating,
  preview = false,
}: {
  rating: Rating | null;
  preview?: boolean;
}) {
  return (
    <aside className="rating-panel panel">
      <div className="eyebrow">
        <TrendingUp size={15} /> ГОТОВНОСТЬ ЗАДАЧИ
      </div>
      {rating ? (
        <>
          <div className="rating-head">
            <ScoreRing score={rating.score} size={92} />
            <div>
              <strong>
                {rating.score}
                <span> / 100</span>
              </strong>
              <p>{levels[rating.level]}</p>
            </div>
          </div>
          {preview && (
            <p className="small muted">
              Предварительная оценка. Подтвердите карточку, чтобы сохранить
              баллы.
            </p>
          )}
          <div className="rating-breakdown">
            {rating.breakdown.map((item) => (
              <div key={item.key}>
                <div>
                  <span>{ratingLabels[item.key]}</span>
                  <b>
                    {item.earned}
                    <span>/{item.max}</span>
                  </b>
                </div>
                <div className="mini-track">
                  <i style={{ width: `${(item.earned / item.max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="improvements">
            <h4>
              <Sparkles size={16} />{" "}
              {rating.improvements.length
                ? "Как повысить рейтинг"
                : "Можно начинать работу"}
            </h4>
            {rating.improvements.length ? (
              rating.improvements.map((item) => (
                <p key={item.fields.join(",")}>{item.message}</p>
              ))
            ) : (
              <p>
                <Check size={14} /> Все разделы заполнены. Проверьте точность
                сведений.
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="muted">Рассчитываем готовность…</p>
      )}
    </aside>
  );
}
