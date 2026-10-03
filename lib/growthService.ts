import i18n from "i18next";
import apiClient from "./apiClient";

// Career Growth (post-hire retention): Saveur-Backend app/api/growth.py.
export interface PayRecord {
  id: number;
  effective_date: string;
  company?: string | null;
  role?: string | null;
  kind: string;
  currency: string;
  base_salary: number;
  bonus?: number | null;
  equity?: string | null;
  note?: string | null;
}
export interface PaySummary {
  count: number;
  current_base?: number;
  currency?: string;
  total_growth_pct?: number;
  annualized_growth_pct?: number;
  months_since_last_change?: number;
}
export interface PromotionPlan {
  goal: string;
  current_role?: string;
  target_role?: string;
  payload: {
    readiness?: { score?: number; summary?: string };
    evidence?: string[];
    talking_points?: { title: string; script: string }[];
    timeline?: { when: string; action: string }[];
    risks?: string[];
  };
}

const lang = () => i18n.language || "en";

export const listPay = () => apiClient.get<{ records: PayRecord[]; summary: PaySummary }>("/api/v1/growth/pay");
export const addPay = (body: Record<string, unknown>) => apiClient.post<{ record: PayRecord; summary: PaySummary }>("/api/v1/growth/pay", body);
export const deletePay = (id: number) => apiClient.delete(`/api/v1/growth/pay/${id}`);
export const getPromotionPlan = () => apiClient.get<{ plan: PromotionPlan | null }>("/api/v1/growth/promotion-plan");
export const makePromotionPlan = (body: Record<string, unknown>) =>
  apiClient.post<{ plan: PromotionPlan }>("/api/v1/growth/promotion-plan", { ...body, language: lang() });
export const getPendingCheckin = () => apiClient.get<{ checkin: { id: number } | null }>("/api/v1/growth/checkin");
export const respondCheckin = (id: number, text: string) => apiClient.post(`/api/v1/growth/checkin/${id}/respond`, { text });
