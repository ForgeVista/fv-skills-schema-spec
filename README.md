# fv-skills-schema-spec

Open spec and reference validator for agent skill metadata.

## What it does

Defines a portable schema for `SKILL.md` frontmatter files used by AI agent skill libraries. The schema is **domain-agnostic** — an FDD library, a swarm-ops library, and a custom client library all use the same structural shape.

**Key concepts:**

- **Layered taxonomy** (L1/L2/Ln) — hierarchical grouping with manifest-declared vocabulary
- **Degrees of freedom** — each skill step rated 1 (deterministic), 2 (confirm/validate), or 3 (creative/exploratory)
- **Directed graph edges** — `downstream` (feeds into) and `related` (cross-reference) relationships between skills
- **Manifest-driven enforcement** — a `skills-manifest.yaml` at the library root declares the rules; the validator checks every skill against it

## Quick start

```bash
# Validate a skill library
npx tsx src/cli.ts ./path/to/skill-library/

# Strict mode (warnings become errors)
npx tsx src/cli.ts ./path/to/skill-library/ --strict

# JSON output
npx tsx src/cli.ts ./path/to/skill-library/ --json
```

## Structure

```
spec/
  skill-schema-spec.md    # Full specification document
src/
  types.ts                # TypeScript type definitions
  schema.ts               # Canonical vocabulary (phases, disciplines, types)
  validator.ts            # Core validation logic
  cli.ts                  # CLI entry point
```

## Spec overview

Each skill library has a `skills-manifest.yaml` that declares:

- **Taxonomy layers** — what L1/L2/Ln mean, their labels, and valid values
- **Tag schemas** — required/optional tags with closed or open value sets
- **Step requirements** — which skill types need workflow steps
- **Edge types** — relationship types the graph renders
- **Constraints** — structural rules (id matches folder, no duplicate edges, etc.)

Individual `SKILL.md` files declare frontmatter validated against the manifest:

```yaml
---
name: ebitda-adjustments
id: ebitda-adjustments
description: >-
  Build the Adjusted EBITDA bridge by identifying and quantifying
  non-recurring items for financial due diligence.
taxonomy:
  L1: "04 — Analysis"
  L2: Earnings
tags:
  type: skill
  status: stable
  labels: [ebitda, qoe, adjustments]
steps:
  - title: "Frame the adjustment universe"
    dof: 3
    description: Identify all candidate adjustment items from the databook.
  - title: "Categorize and quantify"
    dof: 2
    description: Assign each item to a category with quantified impact.
edges:
  downstream: [diligence-results]
  related: [quality-of-revenue, trend-analysis]
---
```

See [spec/skill-schema-spec.md](spec/skill-schema-spec.md) for the full specification.

## License

[MIT](LICENSE)
