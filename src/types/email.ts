export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';
export interface Email { id: string; recipient: string; subject: string; scheduledAt: string; sentAt: string | null; status: EmailStatus; previewUrl: string | null; lastError?: string | null; }
export interface ScheduleEmailRequest { subject: string; body: string; recipients: string[]; startTime: string; delaySeconds: number; hourlyLimit: number; }
export interface ScheduleEmailResponse { success: boolean; campaignId: string; count: number; }