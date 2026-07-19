import "../src/lib/db/load-env";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, extname } from "path";
import { inArray, notInArray, and } from "drizzle-orm";
import { db } from "../src/lib/db";
import { knowledge } from "../src/lib/db/schema";

/**
 * Pushes an explicit include-list of Obsidian vault folders up to the
 * `knowledge` table. Run this locally (`npm run sync:vault`) -- the
 * deployed app has no access to the local filesystem, so this is a
 * one-way, user-initiated push, not a server-side pull. Anything outside
 * the include-list (e.g. 08 Conversations, private journals elsewhere)
 * is never read, let alone synced.
 */

const VAULT_ROOT = "C:\\Users\\Ashton\\Documents\\Ashton OS";
const INCLUDE_FOLDERS = ["00 Dashboard", "01 Projects", "02 Areas", "04 Journal"];

function walkMarkdownFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(full));
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      files.push(full);
    }
  }
  return files;
}

function titleFromContent(content: string, fallback: string): string {
  const heading = content.match(/^#\s+(.+)$/m);
  return heading ? heading[1].trim() : fallback;
}

async function main() {
  const allFiles: { absPath: string; folder: string }[] = [];
  for (const folder of INCLUDE_FOLDERS) {
    const dir = join(VAULT_ROOT, folder);
    for (const absPath of walkMarkdownFiles(dir)) {
      allFiles.push({ absPath, folder });
    }
  }

  const syncedPaths: string[] = [];
  for (const { absPath, folder } of allFiles) {
    const relPath = relative(VAULT_ROOT, absPath).replace(/\\/g, "/");
    const content = readFileSync(absPath, "utf-8");
    const modifiedAt = statSync(absPath).mtime;
    const fallbackTitle = relPath.split("/").pop()!.replace(/\.md$/, "");

    await db
      .insert(knowledge)
      .values({
        path: relPath,
        folder,
        title: titleFromContent(content, fallbackTitle),
        content,
        modifiedAt,
      })
      .onConflictDoUpdate({
        target: knowledge.path,
        set: { folder, title: titleFromContent(content, fallbackTitle), content, modifiedAt, syncedAt: new Date() },
      });
    syncedPaths.push(relPath);
  }

  // Prune rows for files that were deleted or moved out of the include-list
  // since the last sync, scoped to the included folders only so a note the
  // user keeps outside the include-list is never touched by this script.
  const deleted =
    syncedPaths.length > 0
      ? await db
          .delete(knowledge)
          .where(and(inArray(knowledge.folder, INCLUDE_FOLDERS), notInArray(knowledge.path, syncedPaths)))
          .returning({ path: knowledge.path })
      : await db.delete(knowledge).where(inArray(knowledge.folder, INCLUDE_FOLDERS)).returning({ path: knowledge.path });

  console.log(`Synced ${syncedPaths.length} note(s), pruned ${deleted.length}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
