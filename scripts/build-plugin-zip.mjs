// Builds the ChatGPT/Codex plugin submission ZIP from the repo.
// Validates the portable manifest, MCP config, skill, and referenced files,
// then zips plugin.json + mcp.json + skills/ascendant + assets.
//
// Usage: node scripts/build-plugin-zip.mjs [--out dist]
// Output: dist/ascendant-<version>.zip
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(
  root,
  process.argv.includes("--out")
    ? (process.argv[process.argv.indexOf("--out") + 1] ?? "dist")
    : "dist",
);

function fail(message) {
  console.error(`build-plugin-zip: ${message}`);
  process.exit(1);
}

function readJson(relativePath) {
  const full = join(root, relativePath);
  if (!existsSync(full)) fail(`missing ${relativePath}`);
  try {
    return JSON.parse(readFileSync(full, "utf8"));
  } catch {
    fail(`${relativePath} is not valid JSON`);
  }
}

function requireFile(relativePath, why) {
  if (!existsSync(join(root, relativePath))) fail(`missing ${relativePath} (${why})`);
}

// --- plugin.json ---
const manifest = readJson("plugin.json");
if (manifest.name !== "ascendant") fail(`plugin.json name must be "ascendant"`);
if (typeof manifest.version !== "string" || manifest.version.length === 0)
  fail("plugin.json needs a version");
const openai = manifest.extensions?.["com.openai"];
if (!openai) fail("plugin.json needs extensions.com.openai for directory submission");
const ui = openai.interface ?? {};
for (const field of [
  "displayName",
  "shortDescription",
  "longDescription",
  "developerName",
  "category",
  "websiteURL",
  "supportURL",
  "privacyPolicyURL",
  "termsOfServiceURL",
]) {
  if (typeof ui[field] !== "string" || ui[field].length === 0)
    fail(`interface.${field} is required`);
}
if (ui.displayName.length > 30) fail("interface.displayName must be at most 30 characters");
if (ui.shortDescription.length > 30)
  fail("interface.shortDescription must be at most 30 characters");
for (const key of ["composerIcon", "logo"]) {
  if (typeof ui[key] !== "string") fail(`interface.${key} is required`);
  requireFile(ui[key].replace(/^\.\//, ""), `referenced by interface.${key}`);
}
for (const shot of ui.screenshots ?? [])
  requireFile(shot.replace(/^\.\//, ""), "referenced by screenshots");
const onboarding = openai.onboardingSkill?.replace(/^\.\//, "");
if (!onboarding) fail("extensions.com.openai.onboardingSkill is required");
requireFile(onboarding, "onboarding skill");

// --- mcp.json (exactly one remote server) ---
const mcp = readJson("mcp.json");
const servers = Object.entries(mcp.mcpServers ?? {});
if (servers.length !== 1) fail(`mcp.json must declare exactly one server, found ${servers.length}`);
const [serverName, server] = servers[0];
if (server.type !== "streamable-http") fail(`mcp server "${serverName}" must use streamable-http`);
if (typeof server.url !== "string" || !server.url.startsWith("https://")) {
  fail(`mcp server "${serverName}" needs a stable https URL`);
}

// --- skills ---
const skillFile = "skills/ascendant/SKILL.md";
requireFile(skillFile, "packaged skill");
const skill = readFileSync(join(root, skillFile), "utf8");
const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/);
if (!frontmatter) fail("SKILL.md needs YAML frontmatter");
for (const field of ["name:", "description:"]) {
  if (!frontmatter[1].includes(field)) fail(`SKILL.md frontmatter needs ${field}`);
}

// --- review cases (submission requirement) ---
const positive = openai.review?.test_cases?.positive ?? [];
const negative = openai.review?.test_cases?.negative ?? [];
if (positive.length !== 5) fail(`review needs exactly 5 positive cases, found ${positive.length}`);
if (negative.length !== 3) fail(`review needs exactly 3 negative cases, found ${negative.length}`);

// --- zip ---
mkdirSync(outDir, { recursive: true });
const zipName = `ascendant-${manifest.version}.zip`;
const zipPath = join(outDir, zipName);
if (existsSync(zipPath)) rmSync(zipPath);
const entries = ["plugin.json", "mcp.json", "skills/ascendant", "assets"];
for (const entry of entries) requireFile(entry, "zip entry");
execFileSync("zip", ["-r", "-X", "-q", zipPath, ...entries], { cwd: root });
console.log(`build-plugin-zip: wrote ${zipPath} (${serverName} -> ${server.url})`);
