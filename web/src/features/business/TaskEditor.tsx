import type { Card, CardField, Category } from "../../../../contracts/types";
import { useBusinessCopy } from "./locales";

export default function TaskEditor({ card, onChange }: { card: Card; onChange: (card: Card) => void }) {
  const copy = useBusinessCopy();
  return (
    <div className="editor-fields">
      {(Object.keys(copy.labels) as CardField[]).map((field) => (
        <label key={field} htmlFor={`card-${field}`} className={["title", "context", "need"].includes(field) ? "wide" : ""}>
          <span id={`label-${field}`}>{copy.labels[field]}</span>
          {field === "title" ? (
            <input id={`card-${field}`} value={card[field] ?? ""} maxLength={160}
              aria-describedby={`hint-${field}`} aria-labelledby={`label-${field}`}
              onChange={(event) => onChange({ ...card, [field]: event.target.value || null })}
              placeholder={copy.titleHint} />
          ) : (
            <textarea id={`card-${field}`} value={card[field] ?? ""} maxLength={6000} rows={3}
              aria-describedby={`hint-${field}`} aria-labelledby={`label-${field}`}
              onChange={(event) => onChange({ ...card, [field]: event.target.value || null })}
              placeholder={copy.fieldPlaceholder} />
          )}
          <small className="field-hint" id={`hint-${field}`}>{field === "title" ? copy.titleRequired : copy.reasons[field]}</small>
        </label>
      ))}
      <label htmlFor="card-category"><span>{copy.category}</span>
        <select id="card-category" value={card.category} onChange={(event) => onChange({ ...card, category: event.target.value as Category })}>
          {Object.entries(copy.categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
  );
}
