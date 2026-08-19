import axios from 'axios'; import type { User } from '../types/auth'; import type { Email, ScheduleEmailRequest, ScheduleEmailResponse } from '../types/email';
const configuredApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const apiBaseUrl = `${configuredApiUrl.replace(/\/$/, '')}${configuredApiUrl.replace(/\/$/, '').endsWith('/api') ? '' : '/api'}`;
const api = axios.create({ baseURL: apiBaseUrl, withCredentials: true });
export async function getCurrentUser(): Promise<User> { return (await api.get<{ user: User }>('/auth/me')).data.user; }
export async function logout(): Promise<void> { await api.post('/auth/logout'); }
export async function scheduleEmails(input: ScheduleEmailRequest): Promise<ScheduleEmailResponse> { return (await api.post<ScheduleEmailResponse>('/emails/schedule', input)).data; }
export async function getScheduledEmails(): Promise<Email[]> { return (await api.get<{ emails: Email[] }>('/emails/scheduled')).data.emails; }
export async function getSentEmails(): Promise<Email[]> { return (await api.get<{ emails: Email[] }>('/emails/sent')).data.emails; }
export function apiError(error: unknown): string { if (axios.isAxiosError(error)) return error.response?.data?.message || 'Request failed'; return 'Something went wrong'; }