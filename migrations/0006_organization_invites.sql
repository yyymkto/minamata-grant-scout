CREATE TABLE `organization_invites` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `organization_id` integer NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
  `email` text NOT NULL,
  `role` text NOT NULL,
  `token_hash` text NOT NULL,
  `created_by_user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `accepted_by_user_id` integer REFERENCES `users`(`id`) ON DELETE set null,
  `expires_at` text NOT NULL,
  `accepted_at` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
CREATE UNIQUE INDEX `organization_invites_token_hash_unique`
  ON `organization_invites` (`token_hash`);
