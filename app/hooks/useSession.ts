import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client } from "../lib/api";
import { readApiError } from "../lib/errors";

const SESSION_QUERY_KEY = ["session"] as const;
const ORGANIZATIONS_QUERY_KEY = ["organizations"] as const;
const INVITES_QUERY_KEY = ["organization-invites"] as const;

export type MembershipSummary = {
  organizationId: number;
  organizationName: string;
  organizationSlug: string;
  membershipRole: string;
};

export type SessionData = {
  id: number;
  email: string;
  name: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  roles: string[];
  currentOrganizationId: number | null;
  organizationRole: string | null;
  organizations: MembershipSummary[];
};

export type OrganizationsData = {
  currentOrganizationId: number | null;
  organizationRole: string | null;
  organizations: MembershipSummary[];
};

export type InviteSummary = {
  id: number;
  organizationId: number;
  email: string;
  role: string;
  status: "pending" | "accepted" | "expired";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type OrganizationInvitesData = {
  currentOrganizationId?: number;
  invites: InviteSummary[];
};

type CreateInviteResult = {
  invite: InviteSummary & { token: string };
};

export function useSession() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    retry: false,
    queryFn: async () => {
      const res = await client.api.auth.me.$get();
      if (res.status === 401) return null;
      if (!res.ok) throw new Error(await readApiError(res, "Failed to load session"));
      return (await res.json()) as SessionData;
    },
  });
}

export function useSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; password: string; name: string }) => {
      const res = await client.api.auth.signup.$post({ json: input });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to sign up"));
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: INVITES_QUERY_KEY });
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const res = await client.api.auth.login.$post({ json: input });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to log in"));
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: INVITES_QUERY_KEY });
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await client.api.auth["password-reset"].request.$post({
        json: { email },
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, "Failed to request password reset"));
      }
      return res.json();
    },
  });
}

export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: async (input: { token: string; password: string }) => {
      const res = await client.api.auth["password-reset"].confirm.$post({
        json: input,
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, "Failed to reset password"));
      }
      return res.json();
    },
  });
}

export function useRequestEmailVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await client.api.auth["email-verification"].request.$post({
        json: {},
      });
      if (!res.ok) {
        throw new Error(
          await readApiError(res, "Failed to request email verification")
        );
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}

export function useConfirmEmailVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const res = await client.api.auth["email-verification"].confirm.$post({
        json: { token },
      });
      if (!res.ok) {
        throw new Error(
          await readApiError(res, "Failed to verify email")
        );
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await client.api.auth.logout.$post();
      if (!res.ok) throw new Error(await readApiError(res, "Failed to log out"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: INVITES_QUERY_KEY });
    },
  });
}

export function useOrganizations(enabled: boolean) {
  return useQuery({
    queryKey: ORGANIZATIONS_QUERY_KEY,
    enabled,
    queryFn: async () => {
      const res = await client.api.orgs.$get();
      if (!res.ok) throw new Error(await readApiError(res, "Failed to load organizations"));
      return (await res.json()) as OrganizationsData;
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const res = await client.api.orgs.$post({ json: { name } });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to create organization"));
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
    },
  });
}

export function useSwitchOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (organizationId: number) => {
      const res = await client.api.auth["switch-org"].$post({
        json: { organizationId },
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to switch organization"));
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: INVITES_QUERY_KEY });
    },
  });
}

export function useOrganizationInvites(enabled: boolean) {
  return useQuery({
    queryKey: INVITES_QUERY_KEY,
    enabled,
    queryFn: async () => {
      const res = await client.api.orgs.current.invites.$get();
      if (res.status === 403) return { invites: [] } satisfies OrganizationInvitesData;
      if (!res.ok) throw new Error(await readApiError(res, "Failed to load invites"));
      return (await res.json()) as OrganizationInvitesData;
    },
  });
}

export function useCreateOrganizationInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; role: "admin" | "member" }) => {
      const res = await client.api.orgs.current.invites.$post({ json: input });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to create invite"));
      return (await res.json()) as CreateInviteResult;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INVITES_QUERY_KEY });
    },
  });
}

export function useAcceptOrganizationInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const res = await client.api.orgs.invites.accept.$post({
        json: { token },
      });
      if (!res.ok) throw new Error(await readApiError(res, "Failed to accept invite"));
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: INVITES_QUERY_KEY });
    },
  });
}
