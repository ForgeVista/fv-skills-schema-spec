# ForgeVista Skills Viewer Spec (v0.1)

## Overview

This spec defines the frontmatter schema for SKILL.md files that are consumed by:

1. **agentskills.io-compatible agents** — read `name` and `description` to decide which skills to activate
2. **FV Skills Viewer** (web + desktop) — reads extended frontmatter to drive sidebar grouping, graph edges, step navigation, and detail panels

The schema is **domain-agnostic**. An FDD skill library, a swarm-ops library, and a custom client library all use the same structural shape — only the vocabulary (what the layers mean) changes per library.

---

## 1. Architecture

```
┌─────────────────────────────────┐
│  skills-manifest.yaml           │  ← Per-library config (lives at library root)
│  Defines: layers, vocabulary,   │     Declares what L1/L2/Ln mean, valid values,
│  required tags, constraints     │     required fields, and tag schemas
└──────────────┬──────────────────┘
               │ read by
               ▼
┌─────────────────────────────────┐
│  SKILL.md frontmatter           │  ← Per-skill metadata (lives in each skill folder)
│  Uses: id, name, description,   │     Authored by skill creators, validated against
│  taxonomy, tags, steps, edges   │     the manifest
└──────────────┬──────────────────┘
               │ validated by          │ consumed by
               ▼                       ▼
┌──────────────────────┐   ┌────────────────────────┐
│  Validator (CLI/MCP) │   │  Viewer (web/desktop)  │
│  Reads manifest +    │   │  Reads manifest for    │
│  checks every .md    │   │  sidebar labels, graph │
│  against it          │   │  grouping, rendering   │
└──────────────────────┘   └────────────────────────┘
```

### Where files live

```
my-skill-library/
├── skills-manifest.yaml          # The manifest — source of truth for this library
├── skills/
│   ├── skill-a/
│   │   └── SKILL.md              # Skill file with frontmatter
│   ├── skill-b/
│   │   └── SKILL.md
│   └── ...
└── agents/                       # Optional: autonomous agent definitions
    ├── agent-x.md
    └── ...
```

The manifest is **always** at the root of the skill library directory. The validator discovers it automatically when pointed at any directory.

---

## 2. Manifest Format (`skills-manifest.yaml`)

The manifest declares the structure and vocabulary for a skill library.

```yaml
# ── Identity ──────────────────────────────────────────────────────────────────
name: fdd                               # Machine-readable library ID
display: Financial Due Diligence         # Human-readable label
version: 1                              # Manifest schema version

# ── Taxonomy Layers ───────────────────────────────────────────────────────────
# Define the hierarchical grouping structure.
# L1 is the broadest grouping, L2 is nested within L1, etc.
# Depth is flexible — use as many layers as your domain needs.

taxonomy:
  L1:
    label: Phase                         # How the viewer labels this layer
    required: true                       # Must every skill declare L1?
    values:                              # Canonical vocabulary (closed set)
      - "00 — Pre-Engagement"
      - "01 — Data Acquisition"
      - "02 — Trial Balance"
      - "03 — Databook"
      - "04 — Analysis"
      - "05 — Management Session"
      - "06 — Review"
      - "07 — Deliverables"
      - "retro"
      - "agents"

  L2:
    label: Discipline
    required: true
    parent_map:                          # Optional: constrain L2 values per L1
      "00 — Pre-Engagement":
        - Targeting
        - Scoping
      "01 — Data Acquisition":
        - Dataroom
      "02 — Trial Balance":
        - Trial Balance
      "03 — Databook":
        - Databook
      "04 — Analysis":
        - Earnings
        - Working Capital
        - Assets & Debt
        - Analytics
        - Other
      "05 — Management Session":
        - Management Q&A
      "06 — Review":
        - Review
      "07 — Deliverables":
        - Deliverables
      "retro":
        - Retrospective
      "agents":
        - Agents

  # L3, L4, etc. can be added as needed. Omit if not used.
  # L3:
  #   label: Sub-discipline
  #   required: false
  #   values: [...]

# ── Tag Schemas ───────────────────────────────────────────────────────────────
# Tags are key-value classifications outside the taxonomy hierarchy.
# Each tag has a key, optional closed value set, and required flag.

tags:
  type:
    required: true
    values: [skill, retro, agent, moc, template]
    description: What kind of artifact this is

  status:
    required: true
    values: [stable, draft, deprecated]
    description: Lifecycle state

  labels:
    required: false
    open: true                           # Any value allowed (free-form)
    min: 2
    max: 5
    description: Domain keywords for search and filtering

# ── Steps Schema ──────────────────────────────────────────────────────────────
steps:
  required_for: [skill, retro]           # Which `type` values require steps
  fields:
    title:
      required: true
      type: string
    dof:
      required: true
      type: integer
      min: 1
      max: 3
      description: >-
        Degrees of Freedom. 1 = deterministic, 2 = confirm/validate,
        3 = creative/exploratory
    description:
      required: true
      type: string

# ── Edge Schema ───────────────────────────────────────────────────────────────
# Define relationship types that the graph should render.

edges:
  downstream:
    direction: directed                  # Arrow from source → target
    description: Output of this skill feeds input of target skill
  related:
    direction: undirected                # Informational cross-reference
    description: Skills at the same level or discipline

# ── Constraints ───────────────────────────────────────────────────────────────
constraints:
  id_matches_folder: true                # id must equal parent folder name
  name_matches_id: true                  # name must equal id
  no_slug_in_both_edges: true            # A slug cannot appear in both downstream and related
  wikilinks_match_edges: true            # Every edge slug should appear as [[slug]] in body
  retro_not_in_edges: true               # Main skills should not reference retro slugs in edges
```

### Manifest for a different library (example: swarm-ops)

```yaml
name: swarm-ops
display: Swarm Operations
version: 1

taxonomy:
  L1:
    label: Stage
    required: true
    values: [planning, pre-flight, launch, active, review, retro]
  L2:
    label: Role
    required: false
    values: [coordinator, worker, qa, support]

tags:
  type:
    required: true
    values: [skill, retro, agent, template]
  status:
    required: true
    values: [stable, draft, deprecated]
  labels:
    required: false
    open: true
    min: 1
    max: 5

steps:
  required_for: [skill]
  fields:
    title: { required: true, type: string }
    dof: { required: true, type: integer, min: 1, max: 3 }
    description: { required: true, type: string }

edges:
  downstream: { direction: directed }
  related: { direction: undirected }

constraints:
  id_matches_folder: true
  name_matches_id: true
  no_slug_in_both_edges: true
  wikilinks_match_edges: false           # Swarm skills don't use wikilinks heavily
  retro_not_in_edges: true
```

### Modeling approval-gated social account workflows

Use `dof: 2` for steps that change an external account and require approval
before execution. This keeps the skill deterministic enough for validators while
making the human review boundary explicit in the graph.

```yaml
steps:
  - title: "Collect public X/Twitter source context"
    dof: 1
    description: Read supplied source packets and preserve URLs, authors, and capture dates.
  - title: "Prepare account-changing action"
    dof: 2
    description: Draft the post or reply, then require explicit user approval before publishing.
  - title: "Record the approved action"
    dof: 1
    description: Store only the approved action summary and source references.
```

---

## 3. Skill File Frontmatter Schema

Every SKILL.md file uses this frontmatter structure. Field names are fixed by the spec; values are validated against the library's manifest.

```yaml
---
# ── agentskills.io required ───────────────────────────────────────────────────
name: ebitda-adjustments                 # Must match parent folder name
description: >-                          # 80-1024 characters, domain terms included
  Build the Adjusted EBITDA and Quality of Earnings bridge by identifying,
  categorizing, and quantifying non-recurring items for FDD.

# ── agentskills.io optional ───────────────────────────────────────────────────
compatibility: Designed for Claude Code with access to FDD engagement files.

# ── Identity ──────────────────────────────────────────────────────────────────
id: ebitda-adjustments                   # Must match name and folder

# ── Taxonomy ──────────────────────────────────────────────────────────────────
taxonomy:
  L1: "04 — Analysis"
  L2: Earnings

# ── Tags ──────────────────────────────────────────────────────────────────────
tags:
  type: skill
  status: stable
  labels:
    - ebitda
    - qoe
    - adjustments

# ── Steps ─────────────────────────────────────────────────────────────────────
steps:
  - title: "Step 1: Frame the adjustment universe"
    dof: 3
    description: Identify all candidate adjustment items from the databook.
  - title: "Step 2: Categorize and quantify"
    dof: 2
    description: Assign each item to a category with quantified impact.

# ── Edges ─────────────────────────────────────────────────────────────────────
edges:
  downstream:
    - diligence-results
  related:
    - quality-of-revenue
    - trend-analysis
---
```

### Field reference

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | yes | string | Matches folder name. agentskills.io primary identifier. |
| `description` | yes | string | 80-1024 chars. What the skill does + when to use it. |
| `compatibility` | no | string | Runtime requirements. |
| `id` | yes | string | Must equal `name`. Used by viewer for labels, graph, wikilinks. |
| `taxonomy.L1` | per manifest | string | Top-level grouping. Validated against manifest vocabulary. |
| `taxonomy.L2` | per manifest | string | Second-level grouping. Validated against manifest vocabulary. |
| `taxonomy.Ln` | per manifest | string | Additional layers if manifest defines them. |
| `tags.type` | per manifest | string | Artifact classification (skill, retro, agent, etc.). |
| `tags.status` | per manifest | string | Lifecycle state (stable, draft, deprecated). |
| `tags.labels` | per manifest | string[] | Free-form domain keywords. |
| `steps` | per manifest | array | Ordered workflow steps with DoF ratings. |
| `steps[].title` | yes (if steps) | string | Short imperative label. |
| `steps[].dof` | yes (if steps) | integer | Degrees of Freedom: 1, 2, or 3. |
| `steps[].description` | yes (if steps) | string | What completing this step produces. |
| `edges.downstream` | no | string[] | Skills this one feeds into (directed). |
| `edges.related` | no | string[] | Informational cross-references (undirected). |

---

## 4. Validation

### CLI

```bash
# Validate a skill library (auto-discovers skills-manifest.yaml)
fv-skills-schema-spec ./path/to/skill-library/

# Strict mode: warnings become errors
fv-skills-schema-spec ./path/to/skill-library/ --strict

# JSON output for programmatic consumption
fv-skills-schema-spec ./path/to/skill-library/ --json
```

### MCP

Agents get a `validate_skills` tool:

```json
{
  "tool": "validate_skills",
  "args": {
    "directory": "/path/to/skill-library",
    "strict": false
  }
}
```

Returns structured results:

```json
{
  "totalFiles": 75,
  "totalErrors": 0,
  "totalWarnings": 2,
  "files": [
    {
      "filePath": "skills/ebitda-adjustments/SKILL.md",
      "issues": []
    }
  ]
}
```

### Validation rules

The validator checks every SKILL.md against the manifest:

| Rule | Severity | Description |
|------|----------|-------------|
| `name` present and matches folder | error | agentskills.io compliance |
| `id` present and matches `name` | error | Viewer label resolution |
| `description` present, 80-1024 chars | error/warning | agentskills.io compliance |
| `taxonomy.Ln` values in manifest vocabulary | error | Closed vocabulary enforcement |
| `taxonomy.Ln` required per manifest | error | Structural completeness |
| `tags.type` valid per manifest | error | Artifact classification |
| `tags.status` valid per manifest | error | Lifecycle tracking |
| `tags.labels` count within min/max | warning | Quality signal |
| `tags.labels` all lowercase | warning | Consistency |
| `steps` present when required by `tags.type` | error | Viewer panel population |
| `steps[].dof` integer 1-3 | error | DoF system integrity |
| `edges.*` slugs resolve to known folders | error | Graph integrity |
| No slug in both `downstream` and `related` | warning | Graph cycle prevention |
| Wikilinks in body match edge slugs | warning | Graph completeness |
| Main skills don't reference retro in edges | warning | Clean graph layering |

---

## 5. How the Viewer Consumes This

The FV Skills Viewer reads the manifest to configure its UI dynamically:

1. **Sidebar grouping**: "Group by L1" shows Phase groups in FDD, Stage groups in swarm-ops. "Group by L2" nests within L1.
2. **Graph edges**: Renders `downstream` as directed arrows, `related` as undirected lines. Edge types from manifest `edges:` section.
3. **Detail panel**: Shows `tags.type`, `tags.status`, `tags.labels` as badges. Renders `steps` as an accordion with DoF indicators.
4. **Sidebar labels**: Uses `name` (falling back to `id`, then folder name).
5. **Cycle detection**: Only runs on `directed` edge types (downstream), not `undirected` (related).

The viewer does **not** need to know what "Phase" or "Discipline" means — it reads the manifest's `label` fields and renders generically.

---

## 6. Manifest Management

### Who creates the manifest?

The skill library author. When you create a new plugin or skill library, you define `skills-manifest.yaml` at the root alongside your `skills/` directory.

### How is it versioned?

The manifest has a `version: N` field. The validator and viewer check this to ensure compatibility. Breaking changes to the manifest schema increment the version.

### What if no manifest exists?

The validator falls back to a **default manifest** that enforces:
- `name`, `id`, `description` required
- `tags.type` and `tags.status` required with standard values
- No taxonomy enforcement (L1/L2 checks skipped)
- Steps required for `type: skill`

This means any skill library works out of the box — the manifest adds strictness on top.

### Generating a manifest from existing files

```bash
# Scan existing files and generate a draft manifest
fv-skills-schema-spec ./path/to/library/ --init
```

This reads all SKILL.md files, infers the vocabulary from existing values, and writes a draft `skills-manifest.yaml` that the author can review and tighten.

---

## 7. Migration from Flat Fields

Libraries currently using flat frontmatter fields (`phase:`, `discipline:`, `type:`, `status:`) can migrate to the structured format. The validator supports **both** formats during transition:

**Flat (legacy):**
```yaml
phase: "04 — Analysis"
discipline: Earnings
type: skill
status: stable
tags:
  - ebitda
  - qoe
```

**Structured (spec-compliant):**
```yaml
taxonomy:
  L1: "04 — Analysis"
  L2: Earnings
tags:
  type: skill
  status: stable
  labels:
    - ebitda
    - qoe
```

The validator reads both and reports which files need migration. The `--migrate` flag rewrites files in-place:

```bash
fv-skills-schema-spec ./path/to/library/ --migrate
```
