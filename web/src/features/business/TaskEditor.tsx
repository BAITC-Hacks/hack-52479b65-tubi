import type { Card, CardField, Category } from "../../../../contracts/types";
import { categories, labels } from "../../shared/constants";
export default function TaskEditor({
  card,
  onChange,
}: {
  card: Card;
  onChange: (card: Card) => void;
}) {
  const fields = Object.keys(labels) as CardField[];
  return (
    <div className="editor-fields">
      {fields.map((field) => (
        <label
          key={field}
          className={["title", "context", "need"].includes(field) ? "wide" : ""}
        >
          <span>
            {labels[field]} {field === "title" && <b className="required">*</b>}
          </span>
          {field === "title" ? (
            <input
              value={card[field] || ""}
              maxLength={160}
              onChange={(e) =>
                onChange({ ...card, [field]: e.target.value || null })
              }
              placeholder="Коротко и понятно: что нужно сделать?"
            />
          ) : (
            <textarea
              value={card[field] || ""}
              maxLength={6000}
              rows={3}
              onChange={(e) =>
                onChange({ ...card, [field]: e.target.value || null })
              }
              placeholder="Добавьте известные вам сведения"
            />
          )}
        </label>
      ))}
      <label>
        <span>Направление</span>
        <select
          value={card.category}
          onChange={(e) =>
            onChange({ ...card, category: e.target.value as Category })
          }
        >
          {Object.entries(categories).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
