// Applies the Prisma schema to Turso via @libsql/client
import { createClient } from "@libsql/client";
import { readFileSync }  from "fs";
import { resolve }       from "path";

const url       = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) { console.error("TURSO_DATABASE_URL is not set"); process.exit(1); }

const sqlPath = process.argv[2] ?? resolve(import.meta.dirname, "../../tmp/schema.sql");
const sql     = readFileSync(resolve(import.meta.dirname, "schema.sql"), "utf8");

// Split on statement boundaries, strip leading comment lines, keep SQL
const statements = sql
  .split(/;\s*\n/)
  .map(s =>
    s
      .split("\n")
      .filter(line => !line.trimStart().startsWith("--"))
      .join("\n")
      .trim()
  )
  .filter(s => s.length > 0);

const db = createClient({ url, authToken });

console.log(`Connecting to ${url}`);
console.log(`Applying ${statements.length} statements…`);

let ok = 0;
let skipped = 0;
for (const stmt of statements) {
  try {
    await db.execute(stmt);
    ok++;
  } catch (err) {
    const msg = err?.message ?? String(err);
    if (msg.includes("already exists") || msg.includes("duplicate")) {
      skipped++;
    } else {
      console.error(`\nFailed: ${stmt.slice(0, 80)}…`);
      console.error(msg);
    }
  }
}

console.log(`Done — ${ok} applied, ${skipped} skipped (already exist).`);
db.close();
