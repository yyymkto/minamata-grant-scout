import type { Env } from "../types";
import {
  buildEmailVerificationEmail,
  buildInviteEmail,
  buildPasswordResetEmail,
  buildWelcomeEmail,
  sendEmail,
} from "../lib/email";
import { resolveAppBaseUrl } from "../lib/config";
import { logEvent } from "../lib/logging";
import type { JobMessage } from "./types";

/** Replace token values in URLs with [REDACTED] to prevent secret leakage in logs. */
function redactUrlToken(url: string): string {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/token/i.test(key)) {
        parsed.searchParams.set(key, "[REDACTED]");
      }
    }
    return parsed.toString();
  } catch {
    // If the URL can't be parsed, redact the whole thing
    return "[REDACTED_URL]";
  }
}

export async function enqueueJob(queue: Queue<JobMessage>, message: JobMessage) {
  await queue.send(message);
}

export async function handleJobBatch(
  batch: MessageBatch<JobMessage>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    try {
      switch (message.body.type) {
        case "user.welcome":
          {
            const content = buildWelcomeEmail({
              name: message.body.payload.name,
              appBaseUrl: resolveAppBaseUrl(env),
            });
            const delivery = await sendEmail(env, {
              to: message.body.payload.email,
              subject: content.subject,
              html: content.html,
              text: content.text,
              requestId: message.body.payload.requestId,
              idempotencyKey: `user-welcome:${message.body.payload.userId}`,
            });
            logEvent("info", "queue.user_welcome", {
              userId: message.body.payload.userId,
              email: message.body.payload.email,
              delivery: delivery.delivery,
              providerMessageId: delivery.id ?? null,
              requestId: message.body.payload.requestId,
            });
          }
          break;
        case "upload.process":
          logEvent("info", "queue.upload_process", {
            key: message.body.payload.key,
            organizationId: message.body.payload.organizationId,
            size: message.body.payload.size,
            requestId: message.body.payload.requestId,
          });
          break;
        case "organization.invite_email":
          {
            const content = buildInviteEmail({
              organizationName: message.body.payload.organizationName,
              role: message.body.payload.role,
              inviteUrl: message.body.payload.inviteUrl,
            });
            const delivery = await sendEmail(env, {
              to: message.body.payload.email,
              subject: content.subject,
              html: content.html,
              text: content.text,
              requestId: message.body.payload.requestId,
              idempotencyKey: `organization-invite:${message.body.payload.inviteId}`,
            });
            logEvent("info", "queue.organization_invite_email", {
              organizationId: message.body.payload.organizationId,
              organizationName: message.body.payload.organizationName,
              inviteId: message.body.payload.inviteId,
              email: message.body.payload.email,
              role: message.body.payload.role,
              inviteUrl: redactUrlToken(message.body.payload.inviteUrl),
              delivery: delivery.delivery,
              providerMessageId: delivery.id ?? null,
              requestId: message.body.payload.requestId,
            });
          }
          break;
        case "auth.password_reset_email":
          {
            const content = buildPasswordResetEmail({
              resetUrl: message.body.payload.resetUrl,
            });
            const delivery = await sendEmail(env, {
              to: message.body.payload.email,
              subject: content.subject,
              html: content.html,
              text: content.text,
              requestId: message.body.payload.requestId,
              idempotencyKey: `password-reset:${message.body.payload.userId}:${message.body.payload.requestId}`,
            });
            logEvent("info", "queue.auth_password_reset_email", {
              userId: message.body.payload.userId,
              email: message.body.payload.email,
              resetUrl: redactUrlToken(message.body.payload.resetUrl),
              delivery: delivery.delivery,
              providerMessageId: delivery.id ?? null,
              requestId: message.body.payload.requestId,
            });
          }
          break;
        case "auth.email_verification_email":
          {
            const content = buildEmailVerificationEmail({
              verifyUrl: message.body.payload.verifyUrl,
            });
            const delivery = await sendEmail(env, {
              to: message.body.payload.email,
              subject: content.subject,
              html: content.html,
              text: content.text,
              requestId: message.body.payload.requestId,
              idempotencyKey: `email-verification:${message.body.payload.userId}:${message.body.payload.requestId}`,
            });
            logEvent("info", "queue.auth_email_verification_email", {
              userId: message.body.payload.userId,
              email: message.body.payload.email,
              verifyUrl: redactUrlToken(message.body.payload.verifyUrl),
              delivery: delivery.delivery,
              providerMessageId: delivery.id ?? null,
              requestId: message.body.payload.requestId,
            });
          }
          break;
        default:
          throw new Error("unknown job type");
      }

      message.ack();
    } catch (error) {
      logEvent("error", "queue.job_failed", {
        messageId: message.id,
        message: error instanceof Error ? error.message : String(error),
      });
      message.retry();
    }
  }
}
