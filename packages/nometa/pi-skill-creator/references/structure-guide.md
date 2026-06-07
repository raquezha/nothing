# Structure Guide

Choose the smallest structure that still makes the skill reliable.

## Start simple

```text
packages/<bundle>/<skill-name>/
└── SKILL.md
```

For project-local skills outside this repo, use that project's `.pi/skills/<skill-name>/` or `.agents/skills/<skill-name>/` convention.

## Add `references/` when

- the skill needs source-of-truth summaries
- the skill needs schemas, decision trees, or edge cases
- the skill spans multiple variants or subdomains
- `SKILL.md` is getting too long or too branchy

## Add `scripts/` when

- the work is deterministic and repeated
- validation or scaffolding is mechanical
- the same helper logic would otherwise be regenerated repeatedly

## Add `assets/` when

- examples or templates materially improve reliability
- the skill benefits from canonical sample inputs or outputs

## Do not overbuild

Only add files when they improve clarity, reuse, or reliability.

## Practical target

Use these default line-budget targets:

- helper skills: 60-120 lines
- workflow skills: 80-150 lines
- migration or repo-specific skills: 120-180 lines

If a draft goes beyond its target, trim it or move more detail into `references/`.

## Keep in `SKILL.md`

- what the skill does
- when to use it
- hard rules or boundaries
- core workflow
- output contract
- short validation summary
- links to references

## Move into `references/`

- long checklists
- examples
- edge cases
- migration patterns
- source-of-truth summaries
- detailed manual procedures

## Trim pass

Before finalizing, ask:

- what must stay in `SKILL.md` on nearly every run?
- what is repetitive?
- what is example material rather than operational guidance?
- what can move into `references/` without hurting reliability?
