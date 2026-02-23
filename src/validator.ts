import {
  VALID_TYPES,
  VALID_STATUSES,
  VALID_DOF,
  CANONICAL_PHASES,
  CANONICAL_DISCIPLINES,
  ALL_DISCIPLINES,
} from './schema.js';
import type { Issue, FileReport, Severity } from './types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function issue(severity: Severity, file: string, field: string, message: string): Issue {
  return { severity, file, field, message };
}

function extractFrontmatter(text: string): { yaml: string | null; body: string } {
  if (!text.startsWith('---')) return { yaml: null, body: text };
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { yaml: null, body: text };
  return { yaml: match[1] ?? '', body: text.slice(match[0].length) };
}

function extractWikiLinks(body: string): string[] {
  const results: string[] = [];
  const pattern = /\[\[([^\[\]|]+)(?:\|[^\]]+)?\]\]/g;
  let m: RegExpExecArray | null = null;
  while ((m = pattern.exec(body))) {
    const target = (m[1] ?? '').trim();
    if (target) results.push(target);
  }
  return results;
}

/** Phase key from a phase string like "04 — Analysis" → "04" */
function phaseKey(phase: string): string {
  if (phase === 'retro' || phase === 'agents') return phase;
  const m = phase.match(/^(\d{2})\s/);
  return m ? m[1] : phase;
}

// ── Core validator ───────────────────────────────────────────────────────────

/**
 * Main validation entry point. Receives parsed frontmatter object and raw body text.
 */
export function validateParsed(
  filePath: string,
  folderName: string,
  fm: Record<string, unknown>,
  body: string,
  allFolderNames: Set<string>,
): FileReport {
  const issues: Issue[] = [];
  const add = (sev: Severity, field: string, msg: string) =>
    issues.push(issue(sev, filePath, field, msg));

  const isRetro = folderName.endsWith('-retro');
  const isAgent = filePath.includes('/agents/');

  // ── name ─────────────────────────────────────────────────────────────────
  const name = fm['name'];
  if (!name || typeof name !== 'string') {
    add('error', 'name', 'Missing required field `name`');
  } else if (name !== folderName) {
    add('error', 'name', `name "${name}" does not match folder "${folderName}"`);
  }

  // ── id ───────────────────────────────────────────────────────────────────
  const id = fm['id'];
  if (!id || typeof id !== 'string') {
    add('error', 'id', 'Missing required field `id`');
  } else if (id !== folderName) {
    add('error', 'id', `id "${id}" does not match folder "${folderName}"`);
  } else if (name && id !== name) {
    add('warning', 'id', `id "${id}" does not match name "${name}"`);
  }

  // ── description ──────────────────────────────────────────────────────────
  const desc = fm['description'];
  if (!desc || typeof desc !== 'string') {
    add('error', 'description', 'Missing required field `description`');
  } else {
    const len = desc.trim().length;
    if (len < 80) {
      add('warning', 'description', `Description too short (${len} chars, min 80)`);
    }
    if (len > 1024) {
      add('warning', 'description', `Description too long (${len} chars, max 1024)`);
    }
  }

  // ── type ─────────────────────────────────────────────────────────────────
  const type = fm['type'];
  if (!type || typeof type !== 'string') {
    add('error', 'type', 'Missing required field `type`');
  } else if (!(VALID_TYPES as readonly string[]).includes(type)) {
    add('error', 'type', `Invalid type "${type}" — expected one of: ${VALID_TYPES.join(', ')}`);
  } else {
    // Cross-check: retro folders should have type: retro
    if (isRetro && type !== 'retro') {
      add('warning', 'type', `Folder name ends with -retro but type is "${type}" (expected "retro")`);
    }
    if (!isRetro && type === 'retro') {
      add('warning', 'type', `type is "retro" but folder name "${folderName}" does not end with -retro`);
    }
  }

  // ── status ───────────────────────────────────────────────────────────────
  const status = fm['status'];
  if (!status || typeof status !== 'string') {
    add('error', 'status', 'Missing required field `status`');
  } else if (!(VALID_STATUSES as readonly string[]).includes(status)) {
    add('error', 'status', `Invalid status "${status}" — expected one of: ${VALID_STATUSES.join(', ')}`);
  }

  // ── phase ────────────────────────────────────────────────────────────────
  const phase = fm['phase'];
  if (!isAgent) {
    if (!phase || typeof phase !== 'string') {
      add('error', 'phase', 'Missing required field `phase`');
    } else {
      const validPhases = Object.values(CANONICAL_PHASES);
      if (!validPhases.includes(phase)) {
        add('warning', 'phase', `Phase "${phase}" is not in canonical taxonomy`);
      }
    }
  }

  // ── discipline ───────────────────────────────────────────────────────────
  const discipline = fm['discipline'];
  if (!isAgent) {
    if (!discipline || typeof discipline !== 'string') {
      add('error', 'discipline', 'Missing required field `discipline`');
    } else if (!ALL_DISCIPLINES.includes(discipline)) {
      add('warning', 'discipline', `Discipline "${discipline}" is not in canonical taxonomy`);
    } else if (phase && typeof phase === 'string') {
      // Cross-check: discipline should belong to the declared phase
      const pk = phaseKey(phase);
      const validForPhase = CANONICAL_DISCIPLINES[pk];
      if (validForPhase && !validForPhase.includes(discipline)) {
        add('warning', 'discipline', `Discipline "${discipline}" is not expected for phase "${phase}"`);
      }
    }
  }

  // ── steps ────────────────────────────────────────────────────────────────
  const typeStr = typeof type === 'string' ? type : '';
  const needsSteps = typeStr === 'skill' || typeStr === 'retro';
  const steps = fm['steps'];

  if (needsSteps) {
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      add('error', 'steps', 'Missing or empty `steps` array');
    } else {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i] as Record<string, unknown> | undefined;
        if (!step || typeof step !== 'object') {
          add('error', 'steps', `Step ${i + 1} is not a valid object`);
          continue;
        }
        if (!step['title'] || typeof step['title'] !== 'string') {
          add('error', 'steps', `Step ${i + 1} missing \`title\``);
        }
        const dof = step['dof'];
        if (dof === undefined || dof === null) {
          add('error', 'steps', `Step ${i + 1} missing \`dof\``);
        } else if (typeof dof !== 'number' || !(VALID_DOF as readonly number[]).includes(dof)) {
          add('error', 'steps', `Step ${i + 1} dof "${dof}" must be 1, 2, or 3`);
        }
        if (!step['description'] || typeof step['description'] !== 'string') {
          add('error', 'steps', `Step ${i + 1} missing \`description\``);
        }
      }
    }
  }

  // ── tags ─────────────────────────────────────────────────────────────────
  const tags = fm['tags'];
  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      add('warning', 'tags', '`tags` should be an array');
    } else {
      if (tags.length < 2) add('warning', 'tags', `Only ${tags.length} tag(s) — recommend 2-5`);
      if (tags.length > 5) add('warning', 'tags', `${tags.length} tags — recommend 2-5`);
      for (const tag of tags) {
        if (typeof tag !== 'string') {
          add('warning', 'tags', `Tag "${tag}" is not a string`);
        } else if (tag !== tag.toLowerCase()) {
          add('warning', 'tags', `Tag "${tag}" should be lowercase`);
        }
      }
    }
  }

  // ── related / downstream ─────────────────────────────────────────────────
  for (const field of ['related', 'downstream'] as const) {
    const arr = fm[field];
    if (arr !== undefined && arr !== null) {
      if (!Array.isArray(arr)) {
        add('warning', field, `\`${field}\` should be an array`);
      } else {
        for (const slug of arr) {
          if (typeof slug !== 'string') {
            add('warning', field, `${field} entry "${slug}" is not a string`);
            continue;
          }
          // Check slug resolves to a known folder
          if (!allFolderNames.has(slug)) {
            add('error', field, `${field} references "${slug}" which is not a known skill folder`);
          }
          // Retro slugs in main skill files
          if (!isRetro && slug.endsWith('-retro')) {
            add('warning', field, `Main skill references retro "${slug}" in ${field}`);
          }
        }
      }
    }
  }

  // Check for slugs in BOTH related and downstream
  const relatedArr = Array.isArray(fm['related']) ? (fm['related'] as string[]) : [];
  const downArr = Array.isArray(fm['downstream']) ? (fm['downstream'] as string[]) : [];
  const overlap = relatedArr.filter((s) => downArr.includes(s));
  if (overlap.length > 0) {
    add('warning', 'related+downstream', `Slug(s) in both related AND downstream: ${overlap.join(', ')}`);
  }

  // ── wikilink audit ───────────────────────────────────────────────────────
  const allSlugs = [...new Set([...relatedArr, ...downArr])];
  if (allSlugs.length > 0) {
    const wikiLinks = new Set(extractWikiLinks(body));
    const missing = allSlugs.filter((s) => !wikiLinks.has(s));
    if (missing.length > 0) {
      add('warning', 'wikilinks', `Frontmatter references not found as [[wikilinks]] in body: ${missing.join(', ')}`);
    }
  }

  return { filePath, folderName, issues };
}
