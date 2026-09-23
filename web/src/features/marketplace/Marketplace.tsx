import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  Filter,
  GraduationCap,
  Layers3,
  LoaderCircle,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import type {
  Category,
  Level,
  Proposal,
  Task,
  Team,
} from "../../../../contracts/types";
import { categories, labels, levels } from "../../shared/constants";
import RatingPanel, { ScoreRing } from "../business/RatingPanel";
import { confirmMilestone, createProposal, decideProposal } from "./api";
import "./marketplace.css";

type Role = "business" | "team";
export function CatalogPage({
  tasks,
  proposals,
  mine,
  role,
  onOpen,
  onCreate,
}: {
  tasks: Task[];
  proposals: Proposal[];
  mine: boolean;
  role: Role;
  onOpen: (t: Task) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [level, setLevel] = useState<Level | "all">("all");
  const [sort, setSort] = useState("score");
  const available = tasks.filter((t) => mine || t.status === "published");
  const visible = useMemo(
    () =>
      available
        .filter(
          (t) =>
            (category === "all" || t.card.category === category) &&
            (level === "all" || t.rating.level === level) &&
            `${t.card.title} ${t.card.context} ${t.card.need}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "score"
            ? b.rating.score - a.rating.score
            : b.created_at.localeCompare(a.created_at),
        ),
    [available, category, level, query, sort],
  );
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ОТКРЫТЫЕ ВОЗМОЖНОСТИ</div>
          <h1>
            {mine
              ? "Ваши задачи, новые возможности"
              : "Реальные задачи. Ваши решения."}
          </h1>
          <p>
            {mine
              ? "Дополняйте карточки, повышайте готовность и знакомьтесь с командами."
              : "Находите интересные вызовы бизнеса и превращайте знания в опыт."}
          </p>
        </div>
        {role === "business" && (
          <button className="button primary" onClick={onCreate}>
            <Plus size={18} /> Создать задачу
          </button>
        )}
      </div>
      {!mine && (
        <section className="hero-banner">
          <div className="hero-copy">
            <span className="hero-pill">
              <Sparkles size={13} /> ОТ ИДЕИ К ДЕЙСТВИЮ
            </span>
            <h2>
              Хорошая задача
              <br />
              притягивает сильную команду.
            </h2>
            <p>
              Добавьте контекст, данные и критерии успеха.
              <br />
              Чем понятнее задача, тем выше её готовность.
            </p>
            {role === "business" ? (
              <button onClick={onCreate}>
                Сформулировать с помощником <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={() =>
                  document.getElementById("catalog-search")?.focus()
                }
              >
                Найти задачу для команды <ArrowRight size={16} />
              </button>
            )}
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="floating-note">
              <span>✦</span> Понятная цель
            </div>
            <div className="art-card">
              <div className="art-card-top">
                <span className="art-icon">
                  <FileText size={20} />
                </span>
                <span>
                  Ваша следующая
                  <br />
                  <b>большая идея</b>
                </span>
                <span className="art-spark">✦</span>
              </div>
              <div className="art-lines">
                <i />
                <i />
              </div>
              <div className="art-progress">
                <span>Готовность к старту</span>
                <b>90 / 100</b>
              </div>
              <div className="art-track">
                <i />
              </div>
              <div className="art-check">
                <Check size={13} /> Всё готово для первого шага
              </div>
            </div>
            <div className="floating-team">
              <div className="mini-avatars">
                <b>А</b>
                <b>Д</b>
                <b>М</b>
              </div>
              <span>
                Команды ждут
                <br />
                <strong>ваших задач</strong>
              </span>
            </div>
            <span className="art-plus plus-one">+</span>
            <span className="art-plus plus-two">✦</span>
          </div>
        </section>
      )}
      <div className="stats-row">
        <div>
          <span className="stat-icon lavender">
            <Layers3 size={19} />
          </span>
          <div>
            <strong>{available.length.toString().padStart(2, "0")}</strong>
            <span>задач в пространстве</span>
          </div>
        </div>
        <div>
          <span className="stat-icon mint">
            <Check size={19} />
          </span>
          <div>
            <strong>
              {available
                .filter((t) => t.rating.score >= 70)
                .length.toString()
                .padStart(2, "0")}
            </strong>
            <span>готовы к совместной работе</span>
          </div>
        </div>
        <div>
          <span className="stat-icon peach">
            <MessageSquare size={19} />
          </span>
          <div>
            <strong>{proposals.length.toString().padStart(2, "0")}</strong>
            <span>предложений от команд</span>
          </div>
        </div>
      </div>
      <div className="catalog-title">
        <h2>
          {mine ? "Мои карточки" : "Каталог задач"}{" "}
          <span>{visible.length}</span>
        </h2>
        <span className="small muted">Выбирайте сами. Все задачи открыты.</span>
      </div>
      <div className="catalog-tools">
        <div className="search-box">
          <Search size={17} />
          <input
            id="catalog-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти задачу по названию или описанию"
            aria-label="Поиск задач"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Очистить поиск">
              <X size={15} />
            </button>
          )}
        </div>
        <label className="filter-select">
          <Filter size={15} />
          <select
            aria-label="Уровень готовности"
            value={level}
            onChange={(e) => setLevel(e.target.value as Level | "all")}
          >
            <option value="all">Любая готовность</option>
            {Object.entries(levels).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="sort-select">
          <select
            aria-label="Сортировка задач"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="score">По готовности ↓</option>
            <option value="newest">Сначала новые</option>
          </select>
        </label>
      </div>
      <div className="category-tabs">
        <button
          className={category === "all" ? "active" : ""}
          onClick={() => setCategory("all")}
        >
          Все направления
        </button>
        {Object.entries(categories)
          .filter(([key]) => key !== "other")
          .map(([key, label]) => (
            <button
              className={category === key ? "active" : ""}
              key={key}
              onClick={() => setCategory(key as Category)}
            >
              {label}
            </button>
          ))}
      </div>
      <div className="task-grid">
        {visible.map((task) => (
          <button
            className="task-card"
            onClick={() => onOpen(task)}
            key={task.id}
          >
            <div className="task-card-top">
              <span className={`category-tag tag-${task.card.category}`}>
                {categories[task.card.category]}
              </span>
              <ScoreRing score={task.rating.score} />
            </div>
            <h3>{task.card.title || "Задача без названия"}</h3>
            <p className="task-summary">
              {task.card.expected_result || task.card.need || task.card.context}
            </p>
            <div className="task-metadata">
              <span>
                <Users size={13} />
                {task.card.users || "Пользователи уточняются"}
              </span>
            </div>
            <div className="task-card-footer">
              <span className={`readiness readiness-${task.rating.level}`}>
                <i />
                {task.status === "draft"
                  ? "Не опубликована"
                  : levels[task.rating.level]}
              </span>
              <span className="card-link">
                Подробнее <ArrowUpRight size={16} />
              </span>
            </div>
          </button>
        ))}
      </div>
      {!visible.length && (
        <div className="empty-state">
          <Search size={30} />
          <h3>Пока ничего не нашлось</h3>
          <p>Попробуйте другую формулировку или сбросьте фильтры.</p>
          <button
            className="button secondary"
            onClick={() => {
              setQuery("");
              setCategory("all");
              setLevel("all");
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      )}
    </div>
  );
}

export function DetailPage({
  task,
  teams,
  proposals,
  role,
  onBack,
  onEdit,
  onRefresh,
  notify,
}: {
  task: Task;
  teams: Team[];
  proposals: Proposal[];
  role: Role;
  onBack: () => void;
  onEdit: () => void;
  onRefresh: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const [teamId, setTeamId] = useState(teams[0]?.id || "");
  const [idea, setIdea] = useState("");
  const [plan, setPlan] = useState("");
  const [deadline, setDeadline] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createProposal(task.id, {
        team_id: teamId,
        idea,
        plan,
        deadline,
        prototype_url: url.trim() || null,
      });
      setIdea("");
      setPlan("");
      setDeadline("");
      setUrl("");
      notify("Предложение отправлено. Решение примет представитель бизнеса.");
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-enter">
      <button className="text-button back" onClick={onBack}>
        <ArrowLeft size={16} /> Каталог задач
      </button>
      <div className="page-heading detail-heading">
        <div>
          <span className={`category-tag tag-${task.card.category}`}>
            {categories[task.card.category]}
          </span>
          <h1>{task.card.title || "Задача без названия"}</h1>
          <div className="detail-meta">
            <span className={`readiness readiness-${task.rating.level}`}>
              <i />
              {levels[task.rating.level]}
            </span>
            <span>
              {task.status === "published"
                ? "Открыта для всех команд"
                : "Сохранена, ещё не опубликована"}
            </span>
          </div>
        </div>
        {role === "business" && (
          <button className="button secondary" onClick={onEdit}>
            Редактировать
          </button>
        )}
      </div>
      <div className="editor-layout">
        <div>
          <section className="panel detail-content">
            {Object.entries(labels)
              .filter(([key]) => key !== "title")
              .map(([key, label]) => (
                <div key={key}>
                  <h3>{label}</h3>
                  <p
                    className={
                      task.card[key as keyof typeof task.card] ? "" : "muted"
                    }
                  >
                    {task.card[key as keyof typeof task.card] ||
                      "Пока не указано — можно уточнить у бизнеса."}
                  </p>
                </div>
              ))}
          </section>
          {role === "team" && task.status === "published" && (
            <form className="panel proposal-form" onSubmit={submit}>
              <div className="section-heading">
                <div className="icon-tile violet">
                  <Send size={21} />
                </div>
                <div>
                  <h2>Предложите своё решение</h2>
                  <p>Расскажите, как ваша команда подойдёт к задаче.</p>
                </div>
              </div>
              {error && (
                <div className="error-box" role="alert">
                  {error}
                </div>
              )}
              <label>
                <span>Ваша команда</span>
                <select
                  required
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                >
                  {teams.map((t) => (
                    <option value={t.id} key={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Идея решения</span>
                <textarea
                  required
                  minLength={5}
                  maxLength={3000}
                  rows={3}
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="Что вы предлагаете и почему это поможет?"
                />
              </label>
              <label>
                <span>Короткий план</span>
                <textarea
                  required
                  minLength={5}
                  maxLength={3000}
                  rows={3}
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  placeholder="С чего начнёте и какие этапы пройдёте?"
                />
              </label>
              <div className="two-columns">
                <label>
                  <span>Предполагаемый срок</span>
                  <input
                    required
                    maxLength={200}
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    placeholder="Например, 14 дней"
                  />
                </label>
                <label>
                  <span>Ссылка на прототип · необязательно</span>
                  <input
                    type="url"
                    maxLength={1000}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </label>
              </div>
              <button className="button primary" disabled={busy || !teamId}>
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Send size={16} />
                )}{" "}
                Отправить предложение
              </button>
            </form>
          )}
          <section className="proposals-section">
            <h2>
              Предложения команд{" "}
              <span className="count-label">{proposals.length}</span>
            </h2>
            {proposals.length ? (
              proposals.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  team={teams.find((t) => t.id === p.team_id)}
                  role={role}
                  onRefresh={onRefresh}
                  notify={notify}
                />
              ))
            ) : (
              <div className="panel empty-small">
                Первое предложение может стать началом большого проекта.
              </div>
            )}
          </section>
        </div>
        <RatingPanel rating={task.rating} />
      </div>
    </div>
  );
}

function ProposalCard({
  proposal,
  team,
  role,
  onRefresh,
  notify,
  taskTitle,
  onOpen,
}: {
  proposal: Proposal;
  team?: Team;
  role: Role;
  onRefresh: () => Promise<void>;
  notify: (m: string) => void;
  taskTitle?: string;
  onOpen?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function act(action: "accepted" | "rejected" | "milestone") {
    setBusy(true);
    setError("");
    try {
      if (action === "milestone") await confirmMilestone(proposal.id);
      else await decideProposal(proposal.id, action);
      notify(
        action === "milestone"
          ? "Этап подтверждён. Команда получила 50 баллов."
          : action === "accepted"
            ? "Вы выбрали команду для совместной работы."
            : "Решение сохранено.",
      );
      await onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="panel proposal-card">
      <div className="proposal-header">
        <span className="proposal-avatar">
          {(team?.name || "К").slice(0, 1)}
        </span>
        <div>
          <h3>{team?.name || proposal.team_id}</h3>
          <p>{team?.skills.join(" · ")}</p>
        </div>
        <span className={`proposal-status ${proposal.status}`}>
          {proposal.status === "pending"
            ? "На рассмотрении"
            : proposal.status === "accepted"
              ? "Команда выбрана"
              : "Отклонено"}
        </span>
      </div>
      {taskTitle && (
        <button className="text-button proposal-task-link" onClick={onOpen}>
          {taskTitle}
          <ArrowUpRight size={13} />
        </button>
      )}
      <p className="proposal-idea">{proposal.idea}</p>
      <p className="proposal-plan">
        <b>План:</b> {proposal.plan}
      </p>
      <div className="proposal-links">
        <span>
          <Clock3 size={14} />
          {proposal.deadline}
        </span>
        {proposal.prototype_url && (
          <a href={proposal.prototype_url} target="_blank" rel="noreferrer">
            Открыть прототип <ArrowUpRight size={14} />
          </a>
        )}
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {role === "business" && proposal.status === "pending" && (
        <div className="proposal-actions">
          <button
            className="button secondary small-button"
            disabled={busy}
            onClick={() => act("rejected")}
          >
            Отклонить
          </button>
          <button
            className="button primary small-button"
            disabled={busy}
            onClick={() => act("accepted")}
          >
            {busy ? (
              <LoaderCircle className="spin" size={14} />
            ) : (
              <Check size={14} />
            )}{" "}
            Выбрать команду
          </button>
        </div>
      )}
      {proposal.status === "accepted" && (
        <div className="milestone-row">
          {proposal.milestone_confirmed ? (
            <span>
              <Trophy size={16} /> Этап подтверждён · +{proposal.points} баллов
              команде
            </span>
          ) : role === "business" ? (
            <>
              <p>
                Начислите баллы после фактического выполнения согласованного
                этапа.
              </p>
              <button
                className="button secondary small-button"
                disabled={busy}
                onClick={() => act("milestone")}
              >
                <Check size={14} /> Подтвердить выполненный этап
              </button>
            </>
          ) : (
            <p>
              Баллы за прогресс появятся после подтверждения этапа бизнесом.
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export function ProposalsPage({
  proposals,
  teams,
  tasks,
  role,
  onRefresh,
  onOpen,
  notify,
}: {
  proposals: Proposal[];
  teams: Team[];
  tasks: Task[];
  role: Role;
  onRefresh: () => Promise<void>;
  onOpen: (task: Task) => void;
  notify: (m: string) => void;
}) {
  const [status, setStatus] = useState("all");
  const visible = proposals.filter(
    (p) => status === "all" || p.status === status,
  );
  return (
    <div className="page-enter">
      <div className="page-heading">
        <div>
          <div className="eyebrow">СОВМЕСТНАЯ РАБОТА</div>
          <h1>Идеи команд для ваших задач</h1>
          <p>
            Сравнивайте подходы. Решение о сотрудничестве всегда принимает
            бизнес.
          </p>
        </div>
      </div>
      <div className="category-tabs">
        {[
          ["all", "Все предложения"],
          ["pending", "На рассмотрении"],
          ["accepted", "Выбранные"],
          ["rejected", "Отклонённые"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatus(key)}
            className={status === key ? "active" : ""}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="proposal-list">
        {visible.map((p) => {
          const task = tasks.find((t) => t.id === p.task_id);
          return (
            <ProposalCard
              key={p.id}
              proposal={p}
              team={teams.find((t) => t.id === p.team_id)}
              role={role}
              onRefresh={onRefresh}
              notify={notify}
              taskTitle={task?.card.title || "Задача"}
              onOpen={() => task && onOpen(task)}
            />
          );
        })}
      </div>
      {!visible.length && (
        <div className="empty-state">
          <MessageSquare size={28} />
          <h3>Здесь пока тихо</h3>
          <p>Предложения появятся, когда команды откликнутся на задачи.</p>
        </div>
      )}
    </div>
  );
}
