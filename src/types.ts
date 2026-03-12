import type { JobMessage } from "./queues/types";

export interface Env {
  DB: D1Database;
  KV?: KVNamespace;
  BUCKET: R2Bucket;
  RATE_LIMITER: DurableObjectNamespace;
  JOBS: Queue<JobMessage>;
  ASSETS: Fetcher;
  CORS_ORIGIN?: string;
  COOKIE_SAME_SITE?: string;
  COOKIE_SECURE?: string;
  APP_BASE_URL?: string;
  EMAIL_PROVIDER?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
  RESEND_API_KEY?: string;
}

export interface OrganizationMembershipSummary {
  organizationId: number;
  organizationName: string;
  organizationSlug: string;
  membershipRole: string;
}

export interface OrganizationInviteSummary {
  id: number;
  organizationId: number;
  email: string;
  role: string;
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface AppVariables {
  requestId: string;
  sessionId?: string;
  userId?: number;
  roles?: string[];
  orgId?: number;
  orgRole?: string;
  memberships?: OrganizationMembershipSummary[];
}

export type AppContextEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
