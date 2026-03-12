CREATE INDEX `password_reset_tokens_expires_at_idx`
  ON `password_reset_tokens` (`expires_at`);
CREATE INDEX `email_verification_tokens_expires_at_idx`
  ON `email_verification_tokens` (`expires_at`);
CREATE INDEX `organization_invites_expires_at_idx`
  ON `organization_invites` (`expires_at`);
