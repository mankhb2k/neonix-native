/**
 * Refresh stale integrity hashes in pnpm-lock.yaml against registry.npmjs.org.
 * Does not change resolved package versions — only updates checksum metadata.
 *
 * Usage: node scripts/refresh-pnpm-integrity.mjs [path/to/pnpm-lock.yaml]
 */

import { readFileSync, writeFileSync } from "node:fs";

const lockPath = process.argv[2] ?? "pnpm-lock.yaml";
let content = readFileSync(lockPath, "utf8");

const entryRe =
  /^  ('(?:[^'\\]|\\.)+'|(?:@[^/\n]+\/[^\n@]+|[^\n@/]+)@[^\n:]+):\r?\n    resolution: \{integrity: (sha512-[^}]+)\}/gm;

/** @type {Map<string, string>} */
const entries = new Map();

entryRe.lastIndex = 0;
let match;
while ((match = entryRe.exec(content)) !== null) {
  const spec = match[1].replace(/^'|'$/g, "");
  entries.set(spec, match[2]);
}

/** @param {string} spec */
function parseSpec(spec) {
  const scoped = spec.match(/^(@[^/]+\/[^@]+)@(.+)$/);
  if (scoped) return { name: scoped[1], version: scoped[2] };
  const plain = spec.match(/^([^@]+)@(.+)$/);
  if (plain) return { name: plain[1], version: plain[2] };
  return null;
}

/** @param {string} name @param {string} version */
async function registryIntegrity(name, version) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name).replace(/%40/g, "@")}/${version}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}@${version}: HTTP ${res.status}`);
  const json = await res.json();
  const integrity = json?.dist?.integrity;
  if (!integrity) throw new Error(`${name}@${version}: missing dist.integrity`);
  return integrity;
}

const specs = [...entries.keys()];
const updates = [];

for (let i = 0; i < specs.length; i += 20) {
  const batch = specs.slice(i, i + 20);
  const results = await Promise.all(
    batch.map(async (spec) => {
      const parsed = parseSpec(spec);
      if (!parsed) return null;
      try {
        const current = await registryIntegrity(parsed.name, parsed.version);
        const old = entries.get(spec);
        if (current !== old) {
          return { spec, old, current };
        }
      } catch (error) {
        console.warn(String(error instanceof Error ? error.message : error));
      }
      return null;
    }),
  );
  updates.push(...results.filter(Boolean));
}

for (const { old, current } of updates) {
  content = content.replaceAll(old, current);
}

writeFileSync(lockPath, content);
console.log(
  JSON.stringify(
    {
      checked: specs.length,
      updated: updates.length,
      packages: updates.map((u) => u.spec),
    },
    null,
    2,
  ),
);
