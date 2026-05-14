/** Портфолио. */
export interface PortfolioItem {
  id: number;
  s3_key: string;
  image_url: string;
  caption: string | null;
  is_portfolio: boolean;
  sort_order: number;
}
