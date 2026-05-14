/** Рассылка. */
export interface BroadcastMessage {
  id: number;
  title: string;
  message: string;
  segment: string;
  status: string;
  sent_count?: number;
  created_at: string;
}
