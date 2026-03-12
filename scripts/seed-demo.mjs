#!/usr/bin/env node

import { pbkdf2Sync, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { getPrimaryD1DatabaseName, readWranglerConfig } from "./lib/wrangler-config.mjs";

const { values } = parseArgs({
  options: {
    remote: { type: "boolean" },
    email: { type: "string" },
    password: { type: "string" },
    name: { type: "string" },
  },
});

const email = values.email ?? "demo@example.com";
const password = values.password ?? "demo1234";
const name = values.name ?? "Demo User";
const organizationName = `${name} Workspace`;
const organizationSlug = `demo-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace"}`;
const mode = values.remote ? "--remote" : "--local";

function bytesToHex(buffer) {
  return Buffer.from(buffer).toString("hex");
}

function hashPassword(plainTextPassword) {
  const iterations = 310000;
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(plainTextPassword, salt, iterations, 32, "sha256");
  return `pbkdf2$${iterations}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

function escapeSql(value) {
  return value.replaceAll("'", "''");
}

const { config } = await readWranglerConfig();
const dbName = getPrimaryD1DatabaseName(config);
if (!dbName) {
  console.error("d1_databases[0].database_name not found in wrangler.jsonc");
  process.exit(1);
}

const passwordHash = hashPassword(password);
const sql = [
  "BEGIN TRANSACTION;",
  `INSERT INTO users (email, password_hash, name, email_verified_at)
   VALUES ('${escapeSql(email)}', '${passwordHash}', '${escapeSql(name)}', datetime('now'))
   ON CONFLICT(email) DO UPDATE SET
     password_hash = excluded.password_hash,
     name = excluded.name,
     email_verified_at = excluded.email_verified_at;`,
  `INSERT INTO organizations (name, slug)
   VALUES ('${escapeSql(organizationName)}', '${escapeSql(organizationSlug)}')
   ON CONFLICT(slug) DO UPDATE SET name = excluded.name;`,
  `INSERT OR IGNORE INTO memberships (organization_id, user_id, role)
   SELECT organizations.id, users.id, 'owner'
   FROM organizations, users
   WHERE organizations.slug = '${escapeSql(organizationSlug)}'
     AND users.email = '${escapeSql(email)}';`,
  "COMMIT;",
].join("\n");

const result = spawnSync("wrangler", ["d1", "execute", dbName, mode, "--command", sql], {
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

console.log("");
console.log("Demo seed applied.");
console.log(`Email: ${email}`);
console.log(`Password: ${password}`);
console.log(`Organization: ${organizationName}`);
