import axios from 'axios';
import type { Session, SessionProgress, FinalReport } from './types';

const api = axios.create({
  baseURL: '/api',
});

export const getSessions = () => api.get<Session[]>('/sessions');
export const getSession = (id: string) => api.get<Session>(`/sessions/${id}`);
export const createSession = (data: { topic: string; maxRounds: number }) =>
  api.post<Session>('/sessions', data);
export const pauseSession = (id: string) => api.post(`/sessions/${id}/pause`);
export const resumeSession = (id: string) => api.post(`/sessions/${id}/resume`);
export const cancelSession = (id: string) => api.post(`/sessions/${id}/cancel`);
export const getProgress = (id: string) => api.get<SessionProgress>(`/sessions/${id}/progress`);
export const getReport = (id: string) => api.get<FinalReport>(`/sessions/${id}/report`);

export default api;
