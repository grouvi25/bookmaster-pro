/** Промокод. */
export interface Promo {
  id: number;
  master_id: number;
  promo_type: string;
  code: string | null;
  discount_type: string;
  discount_value: number;
  discount_percent?: number;
  discount_amount?: number;
  max_uses: number | null;
  usage_count?: number;
  used_count?: number;
  is_active: boolean;
}
