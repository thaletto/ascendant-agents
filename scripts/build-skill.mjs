#!/usr/bin/env node
/**
 * Build ascendant skill distribution from a single source of truth.
 *
 * Source:  skills/ascendant/SKILL.src.md (+ instructions/, references/,
 *          scripts/, tools/, agents/)
 * Outputs: skills/ascendant/SKILL.md (canonical, full frontmatter) plus one
 *          generated copy per harness at <configDir>/skills/ascendant/
 *          (e.g. .claude/skills/ascendant/, .opencode/skills/ascendant/).
 *
 * Why SKILL.src.md? The `npx skills` CLI discovers a skill by finding a
 * literal SKILL.md and copies that directory verbatim. If the source file
 * were named SKILL.md, the CLI would install the raw source. Naming it
 * SKILL.src.md hides it from discovery so installs resolve to a compiled
 * copy instead (same trick as impeccable's skill/SKILL.src.md).
 *
 * Only frontmatter varies per provider: each harness gets `name` +
 * `description` + `version` always, and `user-invocable` / `argument-hint`
 * only where that harness honors them (unknown keys are rejected by some
 * validators, e.g. Codex). The body stays byte-identical everywhere: the
 * `<skill-dir>` / `<ascendant-skill-dir>` tokens are resolved by the agent
 * at runtime to the directory holding SKILL.md, so they are portable.
 *
 * Version is read from .claude-plugin/plugin.json. Codex-flavored outputs
 * (.agents) carry it under `metadata.version` instead of top-level
 * `version`, per the OpenAI skills layout.
 *
 * Run: `node scripts/build-skill.mjs` (or `npm run build:skill`).
 * No dependencies.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(ROOT_DIR, "skills", "ascendant");
const SRC_FILE = path.join(SOURCE_DIR, "SKILL.src.md");

// Subtrees copied verbatim into every generated copy (SKILL.src.md excluded).
const SOURCE_SUBTREES = ["instructions", "references", "scripts", "tools", "agents"];

/**
 * Provider table. configDir is the harness dot-directory; fields lists the
 * optional frontmatter keys emitted beyond name/description/version.
 * versionInMetadata moves `version` under a `metadata` map (Codex layout).
 */
const PROVIDERS = {
  "claude-code": { configDir: ".claude", displayName: "Claude Code", fields: ["user-invocable", "argument-hint"] },
  cursor: { configDir: ".cursor", displayName: "Cursor", fields: [] },
  gemini: { configDir: ".gemini", displayName: "Gemini", fields: [] },
  dsh: { configDir: ".dsh", displayName: "DeepSeek Harness", fields: ["user-invocable"] },
  agents: { configDir: ".agents", displayName: "Codex Repo Skills", fields: [], versionInMetadata: true },
  github: { configDir: ".github", displayName: "GitHub Copilot", fields: ["user-invocable", "argument-hint"] },
  kiro: { configDir: ".kiro", displayName: "Kiro", fields: [] },
  opencode: { configDir: ".opencode", displayName: "OpenCode", fields: ["user-invocable", "argument-hint"] },
  pi: { configDir: ".pi", displayName: "Pi", fields: [] },
  qoder: { configDir: ".qoder", displayName: "Qoder", fields: ["user-invocable", "argument-hint"] },
  trae: { configDir: ".trae", displayName: "Trae", fields: ["user-invocable", "argument-hint"] },
  "trae-cn": { configDir: ".trae-cn", displayName: "Trae China", fields: ["user-invocable", "argument-hint"] },
  "rovo-dev": { configDir: ".rovodev", displayName: "Rovo Dev", fields: ["user-invocable", "argument-hint"] },
  vibe: { configDir: ".vibe", displayName: "Mistral Vibe", fields: ["user-invocable"] },
  veto: { configDir: ".veto", displayName: "Veto", fields: [] },
  grok: { configDir: ".grok", displayName: "Grok Build", fields: ["user-invocable", "argument-hint"] },
  antigravity: { configDir: ".agent", displayName: "Antigravity", fields: [] },
  hermes: { configDir: ".hermes", displayName: "Hermes Agent", fields: [] },
};

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (/^(".*"|'.*')$/.test(value)) value = value.slice(1, -1);
    else if (value === "true") value = true;
    else if (value === "false") value = false;
    frontmatter[key] = value;
  }
  return { frontmatter, body: match[2].trim() + "\n" };
}

function yamlNeedsQuoting(value) {
  if (value === "") return true;
  if (/^\s|\s$/.test(value)) return true;
  if (/^[{[\],&*!|>'"%@`#?]/.test(value)) return true;
  if (/:\s|\s#|:$/.test(value)) return true;
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(value)) return true;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value)) return true;
  return false;
}

function yamlScalar(value) {
  if (typeof value === "boolean") return String(value);
  const s = String(value);
  return yamlNeedsQuoting(s) ? `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : s;
}

function generateFrontmatter(data) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const [k, v] of Object.entries(value)) lines.push(`  ${k}: ${yamlScalar(v)}`);
    } else {
      lines.push(`${key}: ${yamlScalar(value)}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

function copyDirPreservingModes(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirPreservingModes(src, dest);
    } else if (entry.isFile()) {
      fs.copyFileSync(src, dest);
      fs.chmodSync(dest, fs.statSync(src).mode & 0o777);
    }
  }
}

/**
 * Make a generated skill dir match source: write SKILL.md, then replace
 * each managed subtree wholesale so deleted source files cannot linger.
 * Only the skill dir itself is managed; sibling files (e.g.
 * .opencode/plugins/, hooks configs) are untouched.
 */
function mirrorSkillDir(destSkillDir, skillMd) {
  fs.mkdirSync(destSkillDir, { recursive: true });
  fs.writeFileSync(path.join(destSkillDir, "SKILL.md"), skillMd, "utf-8");
  for (const tree of SOURCE_SUBTREES) {
    const src = path.join(SOURCE_DIR, tree);
    const dest = path.join(destSkillDir, tree);
    if (!fs.existsSync(src)) {
      fs.rmSync(dest, { recursive: true, force: true });
      continue;
    }
    fs.rmSync(dest, { recursive: true, force: true });
    copyDirPreservingModes(src, dest);
  }
}

function readSource() {
  if (!fs.existsSync(SRC_FILE)) throw new Error(`Source of truth missing: ${SRC_FILE}`);
  const { frontmatter, body } = parseFrontmatter(fs.readFileSync(SRC_FILE, "utf-8"));
  if (!frontmatter.name) throw new Error("SKILL.src.md must declare `name`");
  if (!frontmatter.description) throw new Error("SKILL.src.md must declare `description`");
  if (frontmatter.description.length > 1024) {
    throw new Error(`description exceeds 1024 chars (${frontmatter.description.length})`);
  }
  return { frontmatter, body };
}

function readSkillsVersion() {
  const pluginJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, ".claude-plugin", "plugin.json"), "utf-8"));
  if (!pluginJson.version) throw new Error(".claude-plugin/plugin.json must declare `version`");
  return pluginJson.version;
}

function buildSkillMarkdown(frontmatter, body, { fields, version, versionInMetadata }) {
  const out = { name: frontmatter.name, description: frontmatter.description };
  if (version && !versionInMetadata) out.version = version;
  if (fields.includes("user-invocable") && frontmatter["user-invocable"]) out["user-invocable"] = true;
  if (fields.includes("argument-hint") && frontmatter["user-invocable"] && frontmatter["argument-hint"]) {
    out["argument-hint"] = frontmatter["argument-hint"];
  }
  if (version && versionInMetadata) out.metadata = { version };
  return `${generateFrontmatter(out)}\n\n${body}`;
}

function build() {
  const { frontmatter, body } = readSource();
  const version = readSkillsVersion();

  // 1. Canonical copy: skills/ascendant/SKILL.md (full frontmatter for the
  // Claude plugin at .claude-plugin/plugin.json -> ./skills/ascendant and
  // for `npx skills add`, which copies this directory verbatim). The source
  // dir IS the canonical dir, so only SKILL.md is written here; subtrees
  // are already the source of truth.
  fs.writeFileSync(
    path.join(SOURCE_DIR, "SKILL.md"),
    buildSkillMarkdown(frontmatter, body, {
      fields: ["user-invocable", "argument-hint"],
      version,
      versionInMetadata: false,
    }),
    "utf-8",
  );
  console.log(`✓ canonical: skills/ascendant/SKILL.md (v${version})`);

  // 2. Per-harness copies.
  for (const [key, config] of Object.entries(PROVIDERS)) {
    const destSkillDir = path.join(ROOT_DIR, config.configDir, "skills", "ascendant");
    mirrorSkillDir(
      destSkillDir,
      buildSkillMarkdown(frontmatter, body, {
        fields: config.fields,
        version,
        versionInMetadata: !!config.versionInMetadata,
      }),
    );
    console.log(`✓ ${config.displayName}: ${config.configDir}/skills/ascendant/ (${key})`);
  }

  // 3. OpenCode slash-command bridge: OpenCode registers skill commands
  // natively but its TUI autocomplete hides them by design, so ship an
  // explicit command that routes through the skill tool.
  const commandsDir = path.join(ROOT_DIR, ".opencode", "commands");
  fs.mkdirSync(commandsDir, { recursive: true });
  const bridgeFrontmatter = generateFrontmatter({
    description: frontmatter.description,
    agent: "build",
    subtask: true,
  });
  fs.writeFileSync(
    path.join(commandsDir, "ascendant.md"),
    `${bridgeFrontmatter}\nCall skill({ name: "ascendant" }) and follow its \`Arguments\` and \`Routing\` sections to handle $ARGUMENTS.\n`,
    "utf-8",
  );
  console.log("✓ OpenCode: .opencode/commands/ascendant.md");

  console.log("\nBuild complete. Do not hand-edit generated SKILL.md copies; edit skills/ascendant/SKILL.src.md and rebuild.");
}

try {
  build();
} catch (err) {
  console.error(`\nBuild failed: ${err.message}`);
  process.exit(1);
}
