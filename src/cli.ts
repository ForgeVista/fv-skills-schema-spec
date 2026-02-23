#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import yaml from 'js-yaml';
import { validateParsed } from './validator.js';
import type { FileReport, ScanReport, Severity } from './types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const EXCLUDED_DIRS = new Set([
  '.git', 'node_modules', 'dist', '.next', 'target', '__pycache__',
  '.venv', 'venv', 'build', '.cache', '.turbo', '.svelte-kit',
]);

function extractFrontmatter(text: string): { yaml: string | null; body: string } {
  if (!text.startsWith('---')) return { yaml: null, body: text };
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { yaml: null, body: text };
  return { yaml: match[1] ?? '', body: text.slice(match[0].length) };
}

/** Recursively find all SKILL.md files and agent .md files. */
async function findSkillFiles(dir: string): Promise<{ path: string; folderName: string }[]> {
  const results: { path: string; folderName: string }[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        await walk(join(current, entry.name));
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (lower === 'skill.md') {
          const folder = basename(current);
          results.push({ path: join(current, entry.name), folderName: folder });
        } else if (
          lower.endsWith('.md') &&
          current.includes('/agents') &&
          lower !== 'readme.md'
        ) {
          // Agent files: agents/foo-agent.md → folderName = "foo-agent"
          const stem = entry.name.replace(/\.md$/i, '');
          results.push({ path: join(current, entry.name), folderName: stem });
        }
      }
    }
  }

  await walk(dir);
  return results;
}

// ── Output formatting ────────────────────────────────────────────────────────

const COLORS = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

function sevColor(sev: Severity): string {
  if (sev === 'error') return COLORS.red;
  if (sev === 'warning') return COLORS.yellow;
  return COLORS.cyan;
}

function sevIcon(sev: Severity): string {
  if (sev === 'error') return 'x';
  if (sev === 'warning') return '!';
  return 'i';
}

function printReport(report: ScanReport, jsonOutput: boolean): void {
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('');
  console.log(`${COLORS.bold}fv-skills-schema-spec${COLORS.reset}`);
  console.log(`${COLORS.dim}Directory: ${report.directory}${COLORS.reset}`);
  console.log(`${COLORS.dim}Files scanned: ${report.totalFiles} | Skills found: ${report.totalSkills}${COLORS.reset}`);
  console.log('');

  const filesWithIssues = report.files.filter((f) => f.issues.length > 0);

  if (filesWithIssues.length === 0) {
    console.log(`${COLORS.green}All ${report.totalSkills} skill files pass validation.${COLORS.reset}`);
    console.log('');
    return;
  }

  for (const file of filesWithIssues) {
    // Show relative path
    const relPath = file.filePath.startsWith(report.directory)
      ? file.filePath.slice(report.directory.length).replace(/^\//, '')
      : file.filePath;

    console.log(`${COLORS.bold}${relPath}${COLORS.reset}`);
    for (const iss of file.issues) {
      const color = sevColor(iss.severity);
      const icon = sevIcon(iss.severity);
      console.log(`  ${color}${icon}${COLORS.reset} ${COLORS.dim}${iss.field}:${COLORS.reset} ${iss.message}`);
    }
    console.log('');
  }

  // Summary
  const errCount = report.totalErrors;
  const warnCount = report.totalWarnings;
  const parts: string[] = [];
  if (errCount > 0) parts.push(`${COLORS.red}${errCount} error(s)${COLORS.reset}`);
  if (warnCount > 0) parts.push(`${COLORS.yellow}${warnCount} warning(s)${COLORS.reset}`);
  const cleanCount = report.totalSkills - filesWithIssues.length;
  if (cleanCount > 0) parts.push(`${COLORS.green}${cleanCount} clean${COLORS.reset}`);

  console.log(`${COLORS.bold}Summary:${COLORS.reset} ${parts.join(' | ')} ${COLORS.dim}(${report.totalSkills} files)${COLORS.reset}`);
  console.log('');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes('--json');
  const warningsAsErrors = args.includes('--strict');
  const filteredArgs = args.filter((a) => !a.startsWith('--'));

  if (filteredArgs.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: fv-skills-schema-spec <directory> [options]

Options:
  --json      Output results as JSON
  --strict    Treat warnings as errors (affects exit code)
  -h, --help  Show this help message

Examples:
  npx tsx src/cli.ts ./plugins/fdd/
  npx tsx src/cli.ts /path/to/skill-library/ --json
  npx tsx src/cli.ts ./plugins/fdd/ --strict
`);
    process.exit(0);
  }

  const targetDir = filteredArgs[0];
  const dirStat = await stat(targetDir).catch(() => null);
  if (!dirStat || !dirStat.isDirectory()) {
    console.error(`Error: "${targetDir}" is not a directory`);
    process.exit(2);
  }

  // Discover all skill files
  const skillFiles = await findSkillFiles(targetDir);
  if (skillFiles.length === 0) {
    console.error(`No SKILL.md files found in "${targetDir}"`);
    process.exit(2);
  }

  // Build the set of all known folder names (for slug resolution)
  const allFolderNames = new Set(skillFiles.map((f) => f.folderName));

  // Validate each file
  const fileReports: FileReport[] = [];

  for (const { path: filePath, folderName } of skillFiles) {
    const content = await readFile(filePath, 'utf-8');
    const { yaml: yamlStr, body } = extractFrontmatter(content);

    if (!yamlStr) {
      fileReports.push({
        filePath,
        folderName,
        issues: [{ severity: 'error', file: filePath, field: 'frontmatter', message: 'No YAML frontmatter found' }],
      });
      continue;
    }

    let parsed: Record<string, unknown> = {};
    try {
      const loaded = yaml.load(yamlStr);
      if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
        parsed = loaded as Record<string, unknown>;
      } else {
        fileReports.push({
          filePath,
          folderName,
          issues: [{ severity: 'error', file: filePath, field: 'frontmatter', message: 'Frontmatter is not a valid YAML object' }],
        });
        continue;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      fileReports.push({
        filePath,
        folderName,
        issues: [{ severity: 'error', file: filePath, field: 'frontmatter', message: `YAML parse error: ${msg}` }],
      });
      continue;
    }

    const report = validateParsed(filePath, folderName, parsed, body, allFolderNames);
    fileReports.push(report);
  }

  // Build summary
  let totalErrors = 0;
  let totalWarnings = 0;
  for (const fr of fileReports) {
    for (const iss of fr.issues) {
      if (iss.severity === 'error') totalErrors++;
      else if (iss.severity === 'warning') totalWarnings++;
    }
  }

  const report: ScanReport = {
    directory: targetDir,
    totalFiles: skillFiles.length,
    totalSkills: skillFiles.length,
    totalErrors,
    totalWarnings,
    files: fileReports,
  };

  printReport(report, jsonFlag);

  // Exit code
  if (totalErrors > 0) process.exit(1);
  if (warningsAsErrors && totalWarnings > 0) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
