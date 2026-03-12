import { useState } from "react";
import { Panel } from "~/components/Panel";
import {
  useSession,
  useOrganizations,
  useOrganizationInvites,
  useCreateOrganization,
  useCreateOrganizationInvite,
  useAcceptOrganizationInvite,
  useSwitchOrganization,
  useRequestEmailVerification,
  useLogout,
} from "~/hooks/useSession";

export function SettingsPage() {
  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteToken, setInviteToken] = useState("");
  const [latestToken, setLatestToken] = useState<string | null>(null);
  const { data: session } = useSession();
  const { data: organizations } = useOrganizations(!!session);
  const { data: invites } = useOrganizationInvites(!!session);
  const createOrganization = useCreateOrganization();
  const switchOrganization = useSwitchOrganization();
  const createInvite = useCreateOrganizationInvite();
  const acceptInvite = useAcceptOrganizationInvite();
  const requestEmailVerification = useRequestEmailVerification();
  const logout = useLogout();

  if (!session) return null;

  const canManageInvites =
    session.organizationRole === "owner" ||
    session.organizationRole === "admin";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Panel title="Session">
        <div className="space-y-2 text-sm text-slate-300">
          <div>
            {session.name} &middot; {session.email}
          </div>
          <div>roles: {session.roles.join(", ")}</div>
          <div>organizationRole: {session.organizationRole}</div>
          <div>
            emailVerified:{" "}
            {session.emailVerifiedAt ? session.emailVerifiedAt : "pending"}
          </div>
        </div>
        {!session.emailVerifiedAt ? (
          <button
            type="button"
            onClick={() => requestEmailVerification.mutate()}
            disabled={requestEmailVerification.isPending}
            className="mt-4 mr-3 rounded-xl bg-emerald-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
          >
            Resend Verification
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="mt-4 rounded-xl bg-rose-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
        >
          Log Out
        </button>
      </Panel>

      <Panel
        title="Organization Workspace"
        subtitle="Switch organizations, create new ones, or manage invites."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="text-sm text-slate-300">Organizations</div>
            <div className="space-y-2">
              {organizations?.organizations?.map((org) => (
                <button
                  key={org.organizationId}
                  type="button"
                  onClick={() =>
                    switchOrganization.mutate(org.organizationId)
                  }
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${
                    session.currentOrganizationId === org.organizationId
                      ? "border-amber-300/40 bg-amber-300/10"
                      : "border-white/10 bg-slate-950/40"
                  }`}
                >
                  <span>
                    <span className="block font-medium text-white">
                      {org.organizationName}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {org.organizationSlug}
                    </span>
                  </span>
                  <span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                    {org.membershipRole}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <div className="mb-3 text-sm text-slate-300">
                Create Organization
              </div>
              <div className="flex gap-2">
                <input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Regional Ops"
                  className="flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!orgName.trim()) return;
                    createOrganization.mutate(orgName.trim(), {
                      onSuccess: () => setOrgName(""),
                    });
                  }}
                  disabled={createOrganization.isPending}
                  className="rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
              {createOrganization.error ? (
                <p className="mt-2 text-sm text-rose-300">
                  {createOrganization.error.message}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <div className="mb-3 text-sm text-slate-300">Accept Invite</div>
              <div className="flex gap-2">
                <input
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  placeholder="Invite token"
                  className="flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!inviteToken.trim()) return;
                    acceptInvite.mutate(inviteToken.trim(), {
                      onSuccess: () => setInviteToken(""),
                    });
                  }}
                  disabled={acceptInvite.isPending}
                  className="rounded-xl bg-fuchsia-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50"
                >
                  Accept
                </button>
              </div>
              {acceptInvite.error ? (
                <p className="mt-2 text-sm text-rose-300">
                  {acceptInvite.error.message}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="Invites"
        subtitle="Manage organization invites."
      >
        {canManageInvites ? (
          <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="user@example.com"
              className="rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
            />
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as "admin" | "member")
              }
              className="rounded-lg border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
            <button
              type="button"
              onClick={() => {
                if (!inviteEmail.trim()) return;
                createInvite.mutate(
                  { email: inviteEmail.trim(), role: inviteRole },
                  {
                    onSuccess: (data) => {
                      setInviteEmail("");
                      setLatestToken(data.invite.token);
                    },
                  }
                );
              }}
              disabled={createInvite.isPending}
              className="rounded-xl bg-amber-400 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50"
            >
              Invite
            </button>
          </div>
        ) : (
          <p className="mb-4 text-sm text-slate-400">
            Only owners and admins can create invites.
          </p>
        )}
        {latestToken ? (
          <div className="mb-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-amber-200/80">
              latest invite token
            </div>
            <div className="mt-2 break-all font-mono text-sm text-amber-100">
              {latestToken}
            </div>
          </div>
        ) : null}
        {createInvite.error ? (
          <p className="mb-4 text-sm text-rose-300">
            {createInvite.error.message}
          </p>
        ) : null}
        <div className="space-y-2">
          {invites?.invites?.length ? (
            invites.invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <div className="font-medium text-white">{invite.email}</div>
                  <div className="text-xs text-slate-400">
                    role {invite.role} &middot; expires {invite.expiresAt}
                  </div>
                </div>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-300">
                  {invite.status}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No invites yet.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}
