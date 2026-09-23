import { request, json } from "../../shared/http";
import type {
  Task,
  Team,
  Proposal,
  ProposalInput,
} from "../../../../contracts/types";
export const listTasks = (mine = false) =>
  request<{ items: Task[] }>(`/tasks${mine ? "?include_drafts=true" : ""}`);
export const listTeams = () => request<{ items: Team[] }>("/teams");
export const listProposals = (id?: string) =>
  request<{ items: Proposal[] }>(id ? `/tasks/${id}/proposals` : "/proposals");
export const createProposal = (id: string, input: ProposalInput) =>
  request<Proposal>(`/tasks/${id}/proposals`, json("POST", input));
export const decideProposal = (id: string, status: "accepted" | "rejected") =>
  request<Proposal>(`/proposals/${id}`, json("PATCH", { status }));
export const confirmMilestone = (id: string) =>
  request<Proposal>(`/proposals/${id}/milestone`, json("POST", {}));
