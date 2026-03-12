import type { Env } from "../types";
import { logEvent } from "./logging";

type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  requestId: string;
  idempotencyKey: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
};

function getEmailProvider(env: Env): "log" | "resend" {
  return env.EMAIL_PROVIDER?.toLowerCase() === "resend" ? "resend" : "log";
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderActionEmail(input: {
  preheader: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
}) {
  const body = escapeHtml(input.body);
  const actionLabel = input.actionLabel ? escapeHtml(input.actionLabel) : null;
  const actionUrl = input.actionUrl ?? null;

  return {
    html: `
      <div style="background:#020617;padding:40px 16px;font-family:ui-sans-serif,system-ui,sans-serif;color:#e2e8f0;">
        <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid rgba(148,163,184,0.18);border-radius:24px;padding:32px;">
          <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#fbbf24;margin-bottom:16px;">cf-starter</div>
          <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#fff;">${escapeHtml(input.title)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#cbd5e1;">${body}</p>
          ${
            actionLabel && actionUrl
              ? `<p style="margin:0 0 24px;">
                  <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#fbbf24;color:#0f172a;text-decoration:none;padding:14px 18px;border-radius:14px;font-weight:700;">
                    ${actionLabel}
                  </a>
                </p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">If the button does not open, use this URL:<br>${escapeHtml(actionUrl)}</p>`
              : ""
          }
        </div>
      </div>
    `.trim(),
    text: [input.preheader, input.body, actionUrl].filter(Boolean).join("\n\n"),
  };
}

export function buildInviteEmail(input: {
  organizationName: string;
  role: string;
  inviteUrl: string;
}) {
  return {
    subject: `Join ${input.organizationName} on cf-starter`,
    ...renderActionEmail({
      preheader: `You're invited to ${input.organizationName}`,
      title: `Join ${input.organizationName}`,
      body: `You were invited as ${input.role}. Use the link below to open the workspace and accept the invitation.`,
      actionLabel: "Open Invitation",
      actionUrl: input.inviteUrl,
    }),
  };
}

export function buildPasswordResetEmail(input: { resetUrl: string }) {
  return {
    subject: "Reset your password",
    ...renderActionEmail({
      preheader: "Reset your password",
      title: "Reset your password",
      body: "A password reset was requested for your account. If this was you, use the link below to set a new password.",
      actionLabel: "Reset Password",
      actionUrl: input.resetUrl,
    }),
  };
}

export function buildEmailVerificationEmail(input: { verifyUrl: string }) {
  return {
    subject: "Verify your email",
    ...renderActionEmail({
      preheader: "Verify your email",
      title: "Verify your email",
      body: "Use the link below to verify this email address and keep your account fully active.",
      actionLabel: "Verify Email",
      actionUrl: input.verifyUrl,
    }),
  };
}

export function buildWelcomeEmail(input: { name: string; appBaseUrl?: string }) {
  return {
    subject: "Welcome to cf-starter",
    ...renderActionEmail({
      preheader: "Welcome to cf-starter",
      title: `Welcome, ${input.name}`,
      body: "Your starter workspace is ready. You can log in and begin configuring organizations, invites, and app-specific features.",
      actionLabel: input.appBaseUrl ? "Open App" : undefined,
      actionUrl: input.appBaseUrl,
    }),
  };
}

export async function sendEmail(
  env: Env,
  message: EmailMessage
): Promise<{ delivery: "log" | "resend"; id?: string }> {
  const provider = getEmailProvider(env);

  if (provider === "log") {
    logEvent("info", "email.delivery_skipped", {
      provider,
      to: message.to,
      subject: message.subject,
      requestId: message.requestId,
    });
    return { delivery: "log" };
  }

  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error("EMAIL_PROVIDER=resend requires RESEND_API_KEY and EMAIL_FROM");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": message.idempotencyKey,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}),
    }),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as ResendResponse;
    throw new Error(payload.message || `resend send failed: ${res.status}`);
  }

  const payload = (await res.json()) as ResendResponse;
  return { delivery: "resend", id: payload.id };
}
