// Runs the Supabase migrations and the pgTAP tests in supabase/tests inside
// PGlite (Postgres compiled to WebAssembly), so the RLS tests need neither
// Docker nor a Supabase project. `supabase test db` runs the same files
// against a real local stack.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const root = new URL("..", import.meta.url).pathname;
const read = (...parts) => readFile(join(root, ...parts), "utf8");
const sqlFiles = async (dir) => (await readdir(join(root, dir))).filter((f) => f.endsWith(".sql")).sort();

const db = new PGlite();
await db.exec(await read("scripts/db-test/supabase-shim.sql"));
for (const file of await sqlFiles("supabase/migrations")) {
  try {
    await db.exec(await read("supabase/migrations", file));
  } catch (error) {
    console.error(`Migration ${file} failed: ${error.message}`);
    process.exit(1);
  }
}
await db.exec(await read("scripts/db-test/pgtap-shim.sql"));

let failures = 0;
for (const file of await sqlFiles("supabase/tests")) {
  // pgTAP is the shim here, not an extension.
  const sql = (await read("supabase/tests", file)).replace(/^\s*create extension[^;]*pgtap[^;]*;/gim, "");
  console.log(`# ${file}`);
  let lines = [];
  try {
    const results = await db.exec(sql);
    lines = results.flatMap((r) => r.rows.map((row) => Object.values(row)[0])).filter((v) => typeof v === "string");
  } catch (error) {
    await db.exec("rollback").catch(() => {});
    lines = [`not ok - ${file} stopped: ${error.message}`];
  }
  // Only TAP lines; set_config() calls in the tests return their value too.
  for (const line of lines.filter((l) => /^(ok|not ok|#|1\.\.)/.test(l))) {
    console.log(line);
    if (/^not ok/m.test(line) || line.startsWith("# Looks like")) failures++;
  }
}

await db.close();
if (failures) {
  console.error(`\n${failures} database test problem(s)`);
  process.exit(1);
}
console.log("\nAll database tests passed");
