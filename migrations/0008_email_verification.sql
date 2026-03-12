ALTER TABLE `users` ADD `email_verified_at` text;

CREATE TABLE `email_verification_tokens` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `token_hash` text NOT NULL,
  `expires_at` text NOT NULL,
  `verified_at` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
CREATE UNIQUE INDEX `email_verification_tokens_token_hash_unique`
  ON `email_verification_tokens` (`token_hash`);
