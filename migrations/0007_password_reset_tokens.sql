CREATE TABLE `password_reset_tokens` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `token_hash` text NOT NULL,
  `expires_at` text NOT NULL,
  `used_at` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
CREATE UNIQUE INDEX `password_reset_tokens_token_hash_unique`
  ON `password_reset_tokens` (`token_hash`);
