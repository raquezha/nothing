---
name: pi-skill-creator
description: Create or improve skills for the Pi coding agent and this nothing repo. Use when turning a workflow, source-of-truth repo, migration pattern, repeated project task, or external skill example into a Pi-native Agent Skill.
---

# Pi Skill Creator

Create and refine Agent Skills tailored for **Pi** and, by default, this **nothing** monorepo.

Do not jump straight into writing `SKILL.md`. First understand the requested skill, gather authoritative context, extract the repeatable workflow, and then generate the smallest reliable skill package.

## Core process

1. Gather requirements and authoritative context.
2. Classify the skill type.
3. Build a design brief.
4. Review the brief with the user when the task is non-trivial.
5. Draft the skill package.
6. Trim, validate, and optionally commit.

## Default destination

For this repo, owned reusable skills usually live under one of:

- `packages/norpiv/<skill-name>/`
- `packages/nometa/<skill-name>/`
- `packages/nosearch/<skill-name>/`
- another explicit package path chosen with the user

If the user asks for a project-local skill in another repo, use that repo's `.pi/skills/` or `.agents/skills/` convention instead. Treat external repos as source context unless the user clearly asks to write there.

## Output requirements

A finished or improved skill should:

- follow the Pi / Agent Skills format
- use a valid lowercase hyphenated `name`
- have a strong `description` that says what the skill does and when to use it
- keep `SKILL.md` focused on activation-time instructions
- move long examples, checklists, and source summaries into `references/`
- include helper scripts only when deterministic reuse justifies them
- reference bundled files with paths relative to the skill directory
- avoid secrets and reference credentials only via environment variables

Pi does not require the frontmatter `name` to match the parent directory, but prefer matching unless this repo intentionally uses a different public command name.

## Skill classes

Classify before drafting.

### Helper skill

Small reusable behavior, formatting guidance, or lightweight instruction set.

Typical output: `SKILL.md` only.

### Workflow skill

Step-by-step operational process.

Typical output: `SKILL.md`, optional `references/`.

### Migration or adoption skill

Moves a project from one state to another.

Typical output: `SKILL.md`, `references/` for decision trees/patterns/edge cases, optional assets.

### Repo-specific operational skill

Teaches Pi how to correctly use a source-of-truth repo, framework, component, or org-standard workflow.

Typical output: `SKILL.md`, distilled `references/`, optional `scripts/`.

If unclear, ask enough questions to classify the skill first.

## Workflow

### 1. Capture the target skill

Clarify:

- what the skill enables Pi to do
- when it should trigger
- whether it creates, updates, migrates, reviews, or standardizes something
- whether it is tied to a specific repo, framework, platform, or internal standard
- what success looks like

Reuse context already present in the conversation before asking repetitive questions.

### 2. Gather authoritative context

Use the right source material before writing:

- local repository files
- existing skills in this repo
- Pi docs and examples when the skill touches Pi behavior
- source-of-truth repos or external skills the user referenced
- web/search context only when needed

When working on Pi topics, read the relevant Pi docs before drafting instructions.

### 3. Build a design brief

For non-trivial skills, synthesize a compact brief covering:

- skill type
- audience or target repo/context
- trigger conditions
- inputs inspected
- outputs or changes produced
- decisions and edge cases
- validation needs
- file structure
- destination path

Pause for user review for migration skills, repo-specific operational skills, or anything risky.

### 4. Draft the skill package

Write for an agent. Be direct and operational.

Preferred sections:

- purpose
- when to use
- hard rules or boundaries
- workflow
- decision rules
- output contract
- validation steps
- references to bundled files

Optimize `SKILL.md` for activation, not long-form documentation.

### 5. Trim before finalizing

Ask:

- what must stay in `SKILL.md` every time?
- what can move into `references/`?
- what is repetitive?
- what is example or edge-case material?
- what would still work if this section were half as long?

Default line-budget targets:

- helper skills: 60-120 lines
- workflow skills: 80-150 lines
- migration or repo-specific skills: 120-180 lines

### 6. Adapt external material instead of copying it

When the user gives an external skill, article, or repo:

1. read it fully
2. extract the useful workflow and concepts
3. strip harness-specific behavior that does not fit Pi
4. rewrite examples, paths, and tooling to match the chosen destination
5. preserve the idea, but make the result feel native to Pi

### 7. Validate before finishing

Check that:

- frontmatter is valid
- the description is explicit enough to trigger reliably
- the structure matches the skill class
- references and scripts are only included when useful
- instructions match Pi, not another harness
- repo paths mentioned in the skill actually exist
- the destination repo/path is correct for the user's workflow
- no security or secret-handling rules are violated

## References

- [description guidance](references/description-guide.md)
- [structure guidance](references/structure-guide.md)
- [starter template](references/scaffold-template.md)
- [review checklist](references/pi-skill-checklist.md)

## Finish-up prompt

Before wrapping up, summarize:

1. what files were added or changed
2. what context shaped the skill
3. why the skill should trigger correctly
4. where the skill was created and why
5. validation run or still needed
6. whether shell/package discovery needs refresh
7. whether the user wants commit/push
