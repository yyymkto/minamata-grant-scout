import { useQuery } from "@tanstack/react-query";
import { client } from "../lib/api";
import { readApiError } from "../lib/errors";

const GRANTS_KEY = ["grants"] as const;

export type GrantSummary = {
  id: number;
  title: string;
  sourceMinistry: string;
  sourceUrl: string;
  publishedAt: string | null;
  deadline: string | null;
  categoryRaw: string | null;
  createdAt: string;
  summaryShort: string | null;
  taraFitRank: string | null;
  taraFitScore: number | null;
  suggestedDepartment: string | null;
};

export type GrantAiAnalysis = {
  id: number;
  grantId: number;
  summaryShort: string | null;
  supportType: string | null;
  targetEntities: string | null;
  maxAmount: string | null;
  subsidyRate: string | null;
  eligibleThemes: string | null;
  requiredDocuments: string | null;
  notes: string | null;
  aiConfidence: number | null;
  taraFitRank: string | null;
  taraFitScore: number | null;
  taraFitReason: string | null;
  suggestedDepartment: string | null;
  suggestedDepartmentReason: string | null;
  taraUseCase: string | null;
};

export type GrantDetail = {
  id: number;
  title: string;
  sourceMinistry: string;
  sourceUrl: string;
  publishedAt: string | null;
  deadline: string | null;
  rawText: string | null;
  categoryRaw: string | null;
  createdAt: string;
  updatedAt: string;
  analysis: GrantAiAnalysis | null;
};

export function useGrants(filters: {
  rank?: string;
  ministry?: string;
  department?: string;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (filters.rank) params.set("rank", filters.rank);
  if (filters.ministry) params.set("ministry", filters.ministry);
  if (filters.department) params.set("department", filters.department);
  if (filters.q) params.set("q", filters.q);

  return useQuery({
    queryKey: [...GRANTS_KEY, filters],
    queryFn: async () => {
      const url = `/api/grants${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to fetch grants"));
      return (await res.json()) as GrantSummary[];
    },
  });
}

export function useGrant(id: number) {
  return useQuery({
    queryKey: [...GRANTS_KEY, id],
    queryFn: async () => {
      const url = `/api/grants/${id}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to fetch grant"));
      return (await res.json()) as GrantDetail;
    },
  });
}
