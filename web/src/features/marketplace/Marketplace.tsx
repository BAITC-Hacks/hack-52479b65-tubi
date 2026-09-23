import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, Check, Clock3, Filter, MessageSquare, Plus, Search, Send, Trophy, Users, X } from "lucide-react";
import type { CardField, Category, Level, Proposal, Task, Team } from "../../../../contracts/types";
import { errorMessage } from "../../shared/http";
import { useLocale } from "../../shared/i18n";
import RatingPanel, { ScoreRing } from "../business/RatingPanel";
import { confirmMilestone, createProposal, decideProposal } from "./api";
import { useMarketplaceCopy } from "./locales";
import TeamReview from "./TeamReview";
import "./marketplace.css";

type Role = "business" | "team";
const asError = (cause: unknown) => cause instanceof Error ? cause : new Error();

export function CatalogPage({ tasks, mine, role, onOpen, onCreate }: {
  tasks: Task[]; proposals: Proposal[]; mine: boolean; role: Role;
  onOpen: (task: Task) => void; onCreate: () => void;
}) {
  const copy = useMarketplaceCopy();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [level, setLevel] = useState<Level | "all">("all");
  const [sort, setSort] = useState("score");
  const available = tasks.filter((task) => mine || task.status === "published");
  const search = query.trim().toLocaleLowerCase();
  const filtered = Boolean(search || category !== "all" || level !== "all");
  const visible = available.filter((task) =>
    (category === "all" || task.card.category === category) &&
    (level === "all" || task.rating.level === level) &&
    [task.card.title, task.card.context, task.card.need, task.card.expected_result]
      .filter(Boolean).join(" ").toLocaleLowerCase().includes(search),
  ).sort((a, b) => sort === "score" ? b.rating.score - a.rating.score : b.created_at.localeCompare(a.created_at));
  function reset() { setQuery(""); setCategory("all"); setLevel("all"); }
  return <div className="page-enter">
    <div className="page-heading">
      <div><h1>{mine ? copy.mine : copy.catalog}</h1><p>{mine ? copy.mineHint : copy.catalogHint}</p></div>
      {role === "business" && <button className="button primary" onClick={onCreate}><Plus size={18} aria-hidden="true" />{copy.create}</button>}
    </div>
    <div className="catalog-tools">
      <div className="search-box">
        <Search size={17} aria-hidden="true" />
        <input id="catalog-search" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.searchHint} aria-label={copy.search} />
        {query && <button onClick={() => setQuery("")} aria-label={copy.clearSearch}><X size={15} aria-hidden="true" /></button>}
      </div>
      <label className="filter-select"><Filter size={15} aria-hidden="true" />
        <select aria-label={copy.readiness} value={level} onChange={(event) => setLevel(event.target.value as Level | "all")}>
          <option value="all">{copy.anyReadiness}</option>
          {Object.entries(copy.levels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
        </select>
      </label>
      <label className="sort-select"><select aria-label={copy.sort} value={sort} onChange={(event) => setSort(event.target.value)}>
        <option value="score">{copy.scoreSort}</option><option value="newest">{copy.newest}</option>
      </select></label>
    </div>
    <div className="category-tabs" role="group" aria-label={copy.directions}>
      <button aria-pressed={category === "all"} className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>{copy.allDirections}</button>
      {Object.entries(copy.categories).map(([key, label]) => <button key={key} aria-pressed={category === key}
        className={category === key ? "active" : ""} onClick={() => setCategory(key as Category)}>{label}</button>)}
    </div>
    <div className="catalog-title">
      <p className="small muted" role="status">{copy.found}: {visible.length} {copy.of} {available.length}</p>
      {filtered && <button className="text-button" onClick={reset}>{copy.reset}</button>}
    </div>
    <div className="task-grid">{visible.map((task) => <button className="task-card" onClick={() => onOpen(task)} key={task.id}>
      <div className="task-card-top"><span className={"category-tag tag-" + task.card.category}>{copy.categories[task.card.category]}</span><ScoreRing score={task.rating.score} /></div>
      <h3>{task.card.title || copy.untitled}</h3>
      <p className="task-summary">{task.card.expected_result || task.card.need || task.card.context}</p>
      <div className="task-metadata"><span><Users size={13} aria-hidden="true" />{task.card.users || copy.usersUnknown}</span></div>
      <div className="task-card-footer">
        <span className={"readiness readiness-" + task.rating.level}><i />{task.status === "draft" ? copy.unpublished : copy.levels[task.rating.level]}</span>
        <span className="card-link">{copy.details}<ArrowUpRight size={16} aria-hidden="true" /></span>
      </div>
    </button>)}</div>
    {!visible.length && <div className="empty-state"><Search size={30} aria-hidden="true" />
      <h2>{filtered ? copy.noResults : copy.noTasks}</h2>
      <p>{filtered ? copy.noResultsHint : mine ? copy.noMineHint : copy.noTasksHint}</p>
    </div>}
  </div>;
}

function ProposalForm({ task, teams, onCreated, onRefresh, notify }: {
  task: Task; teams: Team[]; onCreated: (proposal: Proposal) => void; onRefresh: () => Promise<void>; notify: (text: string) => void;
}) {
  const copy = useMarketplaceCopy();
  const { locale } = useLocale();
  const [teamId, setTeamId] = useState(teams[0]?.id || "");
  const [idea, setIdea] = useState("");
  const [plan, setPlan] = useState("");
  const [deadline, setDeadline] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [saved, setSaved] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const operation = useRef(false);
  const valid = Boolean(teamId && idea.trim().length >= 5 && plan.trim().length >= 5 && deadline.trim());
  async function refresh() {
    setBusy(true);
    try { await onRefresh(); setRefreshFailed(false); }
    catch { setRefreshFailed(true); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid || operation.current || saved) return;
    operation.current = true;
    setBusy(true); setError(null);
    try {
      const proposal = await createProposal(task.id, { team_id: teamId, idea: idea.trim(), plan: plan.trim(), deadline: deadline.trim(), prototype_url: url.trim() || null });
      setSaved(true); onCreated(proposal); notify(copy.sent);
    } catch (cause) {
      setError(asError(cause)); setBusy(false); operation.current = false; return;
    }
    await refresh();
    operation.current = false;
  }
  if (saved) return <section className="panel proposal-form">
    <p role="status">{copy.sent}</p>
    {refreshFailed && <div className="notice"><p>{copy.refreshFailed}</p><button className="button secondary" disabled={busy} onClick={() => void refresh()}>{copy.refresh}</button></div>}
  </section>;
  return <form className="panel proposal-form" onSubmit={(event) => void submit(event)}>
    <div className="section-heading"><div className="icon-tile violet"><Send size={21} aria-hidden="true" /></div>
      <div><h2>{copy.offerTitle}</h2><p>{copy.offerHint}</p></div>
    </div>
    {error && <div className="error-box" role="alert">{errorMessage(error, locale)}</div>}
    <fieldset disabled={busy} aria-busy={busy}>
      <label><span>{copy.team}</span><select required value={teamId} onChange={(event) => setTeamId(event.target.value)}>
        {teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}
      </select></label>
      {!teams.length && <p className="notice">{copy.noTeams}</p>}
      <label><span>{copy.idea}</span><textarea required minLength={5} maxLength={3000} rows={3} value={idea} onChange={(event) => setIdea(event.target.value)} placeholder={copy.ideaHint} /></label>
      <label><span>{copy.plan}</span><textarea required minLength={5} maxLength={3000} rows={3} value={plan} onChange={(event) => setPlan(event.target.value)} placeholder={copy.planHint} /></label>
      <div className="two-columns">
        <label><span>{copy.deadline}</span><input required maxLength={200} value={deadline} onChange={(event) => setDeadline(event.target.value)} placeholder={copy.deadlineHint} /></label>
        <label><span>{copy.prototype}</span><input type="url" maxLength={1000} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" /></label>
      </div>
      <button className="button primary" disabled={busy || !valid}><Send size={16} aria-hidden="true" />{busy ? copy.sending : copy.send}</button>
    </fieldset>
  </form>;
}

export function DetailPage({ task, teams, proposals, role, onBack, onEdit, onRefresh, notify }: {
  task: Task; teams: Team[]; proposals: Proposal[]; role: Role;
  onBack: () => void; onEdit: () => void; onRefresh: () => Promise<void>; notify: (text: string) => void;
}) {
  const copy = useMarketplaceCopy();
  const [created, setCreated] = useState<Proposal | null>(null);
  const visible = created?.task_id === task.id && !proposals.some((proposal) => proposal.id === created.id) ? [...proposals, created] : proposals;
  return <div className="page-enter">
    <button className="text-button back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" />{copy.catalog}</button>
    <div className="page-heading detail-heading"><div>
      <span className={"category-tag tag-" + task.card.category}>{copy.categories[task.card.category]}</span>
      <h1>{task.card.title || copy.untitled}</h1>
      <div className="detail-meta"><span className={"readiness readiness-" + task.rating.level}><i />{copy.levels[task.rating.level]}</span><span>{task.status === "published" ? copy.open : copy.draft}</span></div>
    </div>{role === "business" && <button className="button secondary" onClick={onEdit}>{copy.edit}</button>}</div>
    <div className="editor-layout"><div>
      <section className="panel detail-content">
        {Object.entries(copy.labels).filter(([key]) => key !== "title").map(([key, label]) => <div key={key}><h3>{label}</h3>
          <p className={task.card[key as CardField] ? "" : "muted"}>{task.card[key as CardField] || copy.unknown}</p>
        </div>)}
      </section>
      {role === "team" && task.status === "published" && <ProposalForm key={task.id} task={task} teams={teams} onCreated={setCreated} onRefresh={onRefresh} notify={notify} />}
      <section className="proposals-section"><h2>{copy.offers} <span className="count-label">{visible.length}</span></h2>
        {visible.length ? visible.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} team={teams.find((team) => team.id === proposal.team_id)} role={role} onRefresh={onRefresh} notify={notify} />)
          : <div className="panel empty-small">{copy.noOffers}</div>}
      </section>
    </div><RatingPanel rating={task.rating} /></div>
  </div>;
}

function ProposalCard({ proposal, team, role, onRefresh, notify, taskTitle, onOpen }: {
  proposal: Proposal; team?: Team; role: Role; onRefresh: () => Promise<void>; notify: (text: string) => void; taskTitle?: string; onOpen?: () => void;
}) {
  const copy = useMarketplaceCopy();
  const { locale } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [updated, setUpdated] = useState<Proposal | null>(null);
  const operation = useRef(false);
  const current = updated ? { ...proposal, ...updated, review: proposal.review ?? updated.review } : proposal;
  async function refresh() {
    setBusy(true);
    try { await onRefresh(); setRefreshFailed(false); }
    catch { setRefreshFailed(true); }
    finally { setBusy(false); }
  }
  async function act(action: "accepted" | "rejected" | "milestone") {
    if (operation.current) return;
    operation.current = true;
    setBusy(true); setError(null);
    try {
      const result = action === "milestone" ? await confirmMilestone(current.id) : await decideProposal(current.id, action);
      setUpdated(result);
      notify(action === "milestone" ? copy.milestoneSaved : action === "accepted" ? copy.chosen : copy.decisionSaved);
    } catch (cause) {
      setError(asError(cause)); setBusy(false); operation.current = false; return;
    }
    await refresh();
    operation.current = false;
  }
  return <article className="panel proposal-card">
    <div className="proposal-header"><span className="proposal-avatar" aria-hidden="true">{(team?.name || current.team_id).slice(0, 1)}</span>
      <div><h3>{team?.name || current.team_id}</h3><p>{team?.skills.join(" · ")}</p></div>
      <span className={"proposal-status " + current.status}>{copy[current.status]}</span>
    </div>
    {taskTitle && <button className="text-button proposal-task-link" onClick={onOpen}>{taskTitle}<ArrowUpRight size={13} aria-hidden="true" /></button>}
    <p className="proposal-idea">{current.idea}</p><p className="proposal-plan"><b>{copy.planLabel}:</b> {current.plan}</p>
    <div className="proposal-links"><span><Clock3 size={14} aria-hidden="true" />{current.deadline}</span>
      {current.prototype_url && <a href={current.prototype_url} target="_blank" rel="noreferrer">{copy.openPrototype}<ArrowUpRight size={14} aria-hidden="true" /></a>}
    </div>
    {error && <div className="error-box" role="alert">{errorMessage(error, locale)}</div>}
    {refreshFailed && <div className="notice"><p>{copy.refreshFailed}</p><button className="text-button" disabled={busy} onClick={() => void refresh()}>{copy.refresh}</button></div>}
    {role === "business" && current.status === "pending" && <div className="proposal-actions">
      <button className="button secondary small-button" disabled={busy} onClick={() => void act("rejected")}>{copy.reject}</button>
      <button className="button primary small-button" disabled={busy} onClick={() => void act("accepted")}><Check size={14} aria-hidden="true" />{copy.accept}</button>
    </div>}
    {current.status === "accepted" && <div className="milestone-row">
      {current.milestone_confirmed ? <span><Trophy size={16} aria-hidden="true" />{copy.milestone} · +{current.points} {copy.points}</span>
        : role === "business" ? <><p>{copy.milestoneHint}</p><button className="button secondary small-button" disabled={busy} onClick={() => void act("milestone")}><Check size={14} aria-hidden="true" />{copy.confirmMilestone}</button></>
        : <p>{copy.awaitingMilestone}</p>}
    </div>}
    <TeamReview proposal={current} role={role} onRefresh={onRefresh} />
  </article>;
}

export function ProposalsPage({ proposals, teams, tasks, role, onRefresh, onOpen, notify }: {
  proposals: Proposal[]; teams: Team[]; tasks: Task[]; role: Role;
  onRefresh: () => Promise<void>; onOpen: (task: Task) => void; notify: (text: string) => void;
}) {
  const copy = useMarketplaceCopy();
  const [status, setStatus] = useState("all");
  const visible = proposals.filter((proposal) => status === "all" || proposal.status === status);
  return <div className="page-enter">
    <div className="page-heading"><div><h1>{copy.offersTitle}</h1><p>{copy.offersHint}</p></div></div>
    <div className="category-tabs" role="group" aria-label={copy.statuses}>
      {[["all", copy.allOffers], ["pending", copy.pending], ["accepted", copy.acceptedFilter], ["rejected", copy.rejectedFilter]].map(([key, label]) =>
        <button key={key} aria-pressed={status === key} onClick={() => setStatus(key)} className={status === key ? "active" : ""}>{label} · {key === "all" ? proposals.length : proposals.filter((proposal) => proposal.status === key).length}</button>)}
    </div>
    <div className="proposal-list">{visible.map((proposal) => {
      const task = tasks.find((item) => item.id === proposal.task_id);
      return <ProposalCard key={proposal.id} proposal={proposal} team={teams.find((team) => team.id === proposal.team_id)} role={role} onRefresh={onRefresh} notify={notify} taskTitle={task?.card.title || copy.task} onOpen={() => task && onOpen(task)} />;
    })}</div>
    {!visible.length && <div className="empty-state"><MessageSquare size={28} aria-hidden="true" /><h2>{status === "all" ? copy.noOffers : copy.noFilteredOffers}</h2>
      {status !== "all" && <button className="button secondary" onClick={() => setStatus("all")}>{copy.allOffers}</button>}
    </div>}
  </div>;
}
