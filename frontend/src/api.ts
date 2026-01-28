import axios from "axios";
import type { SessionSummary, ResearchState } from "./types";

const api = axios.create({ baseURL: "/api" });

export const createSession = (goal: string) =>
  api.post<SessionSummary>("/sessions", { goal }).then((r) => r.data);

export const listSessions = () =>
  api.get<SessionSummary[]>("/sessions").then((r) => r.data);

export const getSession = (id: number) =>
  api.get<SessionSummary>(`/sessions/${id}`).then((r) => r.data);

export const getState = (id: number) =>
  api.get<ResearchState>(`/sessions/${id}/state`).then((r) => r.data);

export const runSession = (id: number) =>
  api.post(`/sessions/${id}/run`);

export const generateReport = (id: number) =>
  api.post<{ report: string }>(`/sessions/${id}/report`).then((r) => r.data);

export const intervene = (id: number, action: string, payload: Record<string, unknown>) =>
  api.post(`/sessions/${id}/intervene`, { action, payload });
