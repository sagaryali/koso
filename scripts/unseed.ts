/**
 * Unseed script: removes all demo data created by seed.ts
 *
 * Usage:
 *   npx tsx scripts/unseed.ts
 *
 * Deletes the demo user (demo@koso.dev) which cascade-deletes:
 *   - All workspaces (and their artifacts, evidence, links, embeddings,
 *     codebase connections, codebase modules, market research cache)
 */

import { createClient } from "@supabase/supabase-js";
import { DEMO_USER } from "./seed-data/workspace";
import * as fs from "fs";
import * as path from "path";

// Load env from .env.local
function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) {
    console.error("Error: .env.local not found.");
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const value = trimmed.slice(eqIdx + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("Removing seed data...\n");

  // Find the demo user
  const { data: userList } = await supabase.auth.admin.listUsers();
  const demoUser = userList?.users?.find((u) => u.email === DEMO_USER.email);

  if (!demoUser) {
    console.log(`Demo user ${DEMO_USER.email} not found. Nothing to clean up.`);
    return;
  }

  console.log(`Found demo user: ${demoUser.id}`);

  // Delete workspaces first (cascades to all child tables)
  console.log("Deleting workspaces (cascades to artifacts, evidence, links, embeddings, codebase, cache)...");
  const { error: wsError } = await supabase
    .from("workspaces")
    .delete()
    .eq("user_id", demoUser.id);

  if (wsError) {
    console.error("Failed to delete workspaces:", wsError.message);
  } else {
    console.log("  Workspaces deleted");
  }

  // Delete the auth user
  console.log("Deleting auth user...");
  const { error: userError } = await supabase.auth.admin.deleteUser(demoUser.id);

  if (userError) {
    console.error("Failed to delete user:", userError.message);
  } else {
    console.log("  User deleted");
  }

  console.log("\n--- Unseed complete! All demo data removed. ---");
}

main().catch((err) => {
  console.error("Unseed failed:", err);
  process.exit(1);
});
