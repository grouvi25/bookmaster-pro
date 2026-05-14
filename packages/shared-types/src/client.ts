/** Клиент (CRM-карточка). */
export interface ClientCRM {
  id: number;
  client_id?: number;
  name?: string;
  display_name?: string;
  phone: string | null;
  tags: string[];
  notes?: string;
  master_notes?: string;
  first_visit_date: string | null;
  last_visit_date: string | null;
  visits_count?: number;
  visit_count?: number;
  total_spent?: number;
  total_revenue?: number;
  no_show_count?: number;
  loyalty_points?: number;
  source: string | null;
}
