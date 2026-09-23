import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronRight,
  CircleHelp,
  GraduationCap,
  LayoutGrid,
  LoaderCircle,
  MessageSquare,
  Plus,
  Sparkles,
  SquarePen,
} from "lucide-react";
import type { Health, Proposal, Task, Team } from "../../contracts/types";
import { request } from "./shared/http";
import BusinessPage from "./features/business/BusinessPage";
import {
  CatalogPage,
  DetailPage,
  ProposalsPage,
} from "./features/marketplace/Marketplace";
import {
  listProposals,
  listTasks,
  listTeams,
} from "./features/marketplace/api";

type Page = "catalog" | "mine" | "proposals" | "create" | "detail";
export default function App() {
  const [page, setPage] = useState<Page>("catalog");
  const [role, setRole] = useState<"business" | "team">("business");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const refresh = useCallback(async () => {
    const [taskData, proposalData, teamData, status] = await Promise.all([
      listTasks(true),
      listProposals(),
      listTeams(),
      request<Health>("/health"),
    ]);
    setTasks(taskData.items);
    setProposals(proposalData.items);
    setTeams(teamData.items);
    setHealth(status);
    setError("");
  }, []);
  useEffect(() => {
    refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refresh]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timer);
    }
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
  const selected = tasks.find((t) => t.id === selectedId);
  const pending = proposals.filter((p) => p.status === "pending").length;
  async function done(task: Task) {
    setTasks((old) => [task, ...old.filter((t) => t.id !== task.id)]);
    setSelectedId(task.id);
    navigate("detail");
    setToast(
      task.status === "published"
        ? "Задача опубликована. Команды уже могут откликаться."
        : "Карточка сохранена. Вы можете вернуться к ней позже.",
    );
    try {
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate("catalog")}
          aria-label="Tubi — на главную"
        >
          <span className="brand-symbol">t</span>
          <span>
            tubi<span className="brand-dot">.</span>
          </span>
        </button>
        <div className="workspace-label">
          <span className="workspace-icon">T</span>
          <div>
            <b>Пространство возможностей</b>
            <small>Бизнес × студенты</small>
          </div>
        </div>
        <div className="nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav aria-label="Основная навигация">
          <button
            className={["catalog", "detail"].includes(page) ? "active" : ""}
            onClick={() => navigate("catalog")}
          >
            <LayoutGrid size={18} /> Каталог задач <span className="nav-dot" />
          </button>
          {role === "business" && (
            <button
              className={page === "mine" ? "active" : ""}
              onClick={() => navigate("mine")}
            >
              <SquarePen size={18} /> Мои задачи
            </button>
          )}
          <button
            className={page === "proposals" ? "active" : ""}
            onClick={() => navigate("proposals")}
          >
            <MessageSquare size={18} />{" "}
            {role === "business" ? "Отклики команд" : "Предложения"}
            {pending > 0 && <span className="nav-count">{pending}</span>}
          </button>
        </nav>
        <div className="sidebar-grow" />
        <div className="sidebar-note">
          <span className="tiny-star">✦</span>
          <h4>
            Большие идеи начинаются
            <br />с понятной задачи
          </h4>
          <p>Добавьте детали, повысьте рейтинг и найдите свою команду.</p>
          {role === "business" && (
            <button onClick={() => navigate("create")}>
              Создать задачу <ArrowUpRight size={15} />
            </button>
          )}
        </div>
        <div className="demo-label">
          <CircleHelp size={15} />
          <span>Демо хакатона · роли без входа</span>
        </div>
        <div className="sidebar-footer">
          <div className="team-avatar">Т</div>
          <div>
            <b>Команда Tubi</b>
            <small>AI Sana Hackathon</small>
          </div>
          <span className="online-dot" />
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Рабочее пространство <ChevronRight size={13} />
            <b>
              {page === "create"
                ? "Конструктор"
                : page === "mine"
                  ? "Мои задачи"
                  : page === "proposals"
                    ? "Отклики"
                    : "Каталог задач"}
            </b>
          </div>
          <div className="topbar-right">
            <div className="role-switch" aria-label="Демонстрационная роль">
              <button
                className={role === "business" ? "selected" : ""}
                onClick={() => {
                  setRole("business");
                  navigate("catalog");
                }}
              >
                <BriefcaseBusiness size={14} /> Бизнес
              </button>
              <button
                className={role === "team" ? "selected" : ""}
                onClick={() => {
                  setRole("team");
                  navigate("catalog");
                }}
              >
                <GraduationCap size={15} /> Команда
              </button>
            </div>
            <div className="profile-avatar">ТБ</div>
          </div>
        </header>
        <main>
          {error && (
            <div role="alert" className="error-box">
              {error}
              <button
                className="text-button"
                onClick={() => refresh().catch((e) => setError(e.message))}
              >
                Повторить
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-state">
              <LoaderCircle className="spin" size={25} />
              <p>Открываем пространство Tubi…</p>
            </div>
          ) : (
            <>
              {(page === "catalog" || page === "mine") && (
                <CatalogPage
                  tasks={tasks}
                  proposals={proposals}
                  mine={page === "mine"}
                  role={role}
                  onOpen={openTask}
                  onCreate={() => navigate("create")}
                />
              )}
              {page === "create" && role === "business" && (
                <BusinessPage
                  key={editing?.id || "new"}
                  existing={editing}
                  onDone={done}
                  onCancel={() => navigate("catalog")}
                />
              )}
              {page === "detail" && selected && (
                <DetailPage
                  task={selected}
                  teams={teams}
                  proposals={proposals.filter((p) => p.task_id === selected.id)}
                  role={role}
                  onBack={() => navigate("catalog")}
                  onEdit={() => editTask(selected)}
                  onRefresh={refresh}
                  notify={setToast}
                />
              )}
              {page === "proposals" && (
                <ProposalsPage
                  proposals={proposals}
                  teams={teams}
                  tasks={tasks}
                  role={role}
                  onRefresh={refresh}
                  onOpen={openTask}
                  notify={setToast}
                />
              )}
            </>
          )}
          <footer className="page-footer">
            <span>tubi — место, где задачи находят команды</span>
            <span>
              <Sparkles size={12} />{" "}
              {health?.ai_mode === "live"
                ? "AI подключён"
                : "AI: деморежим без ключа"}
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
          <button onClick={() => setToast("")} aria-label="Закрыть уведомление">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
