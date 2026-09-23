import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutGrid, LoaderCircle, MessageSquare, SquarePen } from "lucide-react";
import type { Health, Proposal, Task, Team } from "../../contracts/types";
import { errorMessage, request } from "./shared/http";
import { useLocale } from "./shared/i18n";
import { commonMessages } from "./shared/i18n/messages";
import LocaleSelect from "./shared/i18n/LocaleSelect";
import BusinessPage from "./features/business/BusinessPage";
import { CatalogPage, DetailPage, ProposalsPage } from "./features/marketplace/Marketplace";
import { listProposals, listTasks, listTeams } from "./features/marketplace/api";

type Page = "catalog" | "mine" | "proposals" | "create" | "detail";

export default function App() {
  const { locale } = useLocale();
  const copy = commonMessages[locale];
  const [page, setPage] = useState<Page>("catalog");
  const [role, setRole] = useState<"business" | "team">("business");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [toast, setToast] = useState("");
  const main = useRef<HTMLElement>(null);
  const refresh = useCallback(async () => {
    const [taskData, proposalData, teamData, status] = await Promise.all([
      listTasks(true), listProposals(), listTeams(), request<Health>("/health"),
    ]);
    setTasks(taskData.items);
    setProposals(proposalData.items);
    setTeams(teamData.items);
    setHealth(status);
    setError(null);
  }, []);
  useEffect(() => {
    if (page !== "create") main.current?.focus({ preventScroll: true });
  }, [page, selectedId]);
  useEffect(() => {
    refresh().catch(setError).finally(() => setLoading(false));
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const navigate = (next: Page) => {
    setPage(next);
    setEditing(undefined);
    window.scrollTo(0, 0);
  };
  const openTask = (task: Task) => {
    setSelectedId(task.id);
    navigate("detail");
  };
  const editTask = (task: Task) => {
    setEditing(task);
    setPage("create");
    window.scrollTo(0, 0);
  };
  const selected = tasks.find((task) => task.id === selectedId);
  const pending = proposals.filter((proposal) => proposal.status === "pending").length;
  const rememberTask = useCallback((task: Task) => {
    setTasks((old) => [task, ...old.filter((item) => item.id !== task.id)]);
  }, []);
  async function done(task: Task) {
    setTasks((old) => [task, ...old.filter((item) => item.id !== task.id)]);
    setSelectedId(task.id);
    navigate("detail");
    try { await refresh(); } catch (cause) { setError(cause as Error); }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{copy.skip}</a>
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("catalog")} aria-label={copy.home}>
          tubi<span className="brand-dot">.</span>
        </button>
        <div className="workspace-label">{copy.workspace}</div>
        <nav aria-label={copy.navigation}>
          <button className={["catalog", "detail"].includes(page) ? "active" : ""}
            aria-current={["catalog", "detail"].includes(page) ? "page" : undefined} onClick={() => navigate("catalog")}>
            <LayoutGrid size={18} aria-hidden="true" />{copy.catalog}
          </button>
          {role === "business" && <button className={page === "mine" ? "active" : ""}
            aria-current={page === "mine" ? "page" : undefined} onClick={() => navigate("mine")}>
            <SquarePen size={18} aria-hidden="true" />{copy.mine}
          </button>}
          <button className={page === "proposals" ? "active" : ""}
            aria-current={page === "proposals" ? "page" : undefined} onClick={() => navigate("proposals")}>
            <MessageSquare size={18} aria-hidden="true" />{role === "business" ? copy.proposals : copy.offers}
            {pending > 0 && <span className="nav-count">{pending}</span>}
          </button>
        </nav>
        <p className="demo-label">{copy.demo}</p>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">{page === "create" ? copy.builder : page === "mine" ? copy.mine : page === "proposals" ? copy.proposals : copy.catalog}</div>
          <div className="topbar-right">
            <div className="role-switch" role="group" aria-label={copy.role}>
              <button aria-pressed={role === "business"} className={role === "business" ? "selected" : ""}
                onClick={() => { if (role !== "business") { setRole("business"); navigate("catalog"); } }}>{copy.business}</button>
              <button aria-pressed={role === "team"} className={role === "team" ? "selected" : ""}
                onClick={() => { if (role !== "team") { setRole("team"); navigate("catalog"); } }}>{copy.team}</button>
            </div>
            <LocaleSelect />
          </div>
        </header>
        <main ref={main} id="main-content" tabIndex={-1}>
          {error && <div role="alert" className="error-box">{errorMessage(error, locale)}
            <button className="text-button" onClick={() => refresh().catch(setError)}>{copy.retry}</button>
          </div>}
          {loading ? (
            <div className="loading-state" role="status"><LoaderCircle className="spin" size={25} aria-hidden="true" /><p>{copy.loading}</p></div>
          ) : (
            <>
              {(page === "catalog" || page === "mine") && <CatalogPage tasks={tasks} proposals={proposals} mine={page === "mine"}
                role={role} onOpen={openTask} onCreate={() => navigate("create")} />}
              {page === "create" && role === "business" && <BusinessPage key={editing?.id || "new"} existing={editing}
                onDone={done} onSaved={rememberTask} onCancel={() => navigate("catalog")} />}
              {page === "detail" && selected && <DetailPage task={selected} teams={teams}
                proposals={proposals.filter((proposal) => proposal.task_id === selected.id)} role={role}
                onBack={() => navigate("catalog")} onEdit={() => editTask(selected)} onRefresh={refresh} notify={setToast} />}
              {page === "proposals" && <ProposalsPage proposals={proposals} teams={teams} tasks={tasks} role={role}
                onRefresh={refresh} onOpen={openTask} notify={setToast} />}
            </>
          )}
          <footer className="page-footer">
            <span>{copy.footer}</span>
            <span>{health ? health.ai_mode === "live" ? copy.aiLive : copy.aiDemo : copy.aiUnknown}</span>
          </footer>
        </main>
      </div>
      {toast && <div className="toast" role="status">{toast}<button onClick={() => setToast("")} aria-label={copy.close}>×</button></div>}
    </div>
  );
}
