/** Услуга мастера. */
export interface Service {
  id: number;
  master_id: number;
  name: string;
  duration_min: number;
  price: number;
  price_max: number | null;
  description: string | null;
  category: string | null;
  is_active: boolean;
  is_online: boolean;
  is_consultation: boolean;
  consultation_url: string | null;
  sort_order: number;
}
