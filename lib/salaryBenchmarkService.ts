import i18n from "i18next";
import apiClient from "./apiClient";

export interface SalaryBenchmark {
  title: string;
  location: string;
  years_experience: number | null;
  currency: string;
  period: "year";
  percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number };
  confidence: "low" | "medium" | "high";
  factors: { name: string; effect: "raises" | "lowers"; detail: string }[];
  negotiation_tip: string;
  caveat: string;
}

export const getSalaryBenchmark = (body: {
  title: string;
  location: string;
  years_experience?: number;
  currency?: string;
  industry?: string;
}) => apiClient.post<SalaryBenchmark>("/api/v1/salary/benchmark", { ...body, language: i18n.language || "en" });
