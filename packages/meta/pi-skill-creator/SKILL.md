---
name: pi-skill-creator
description: Create or improve skills specifically for the pi coding agent and the pi.dev repository. Use when the user wants to turn a workflow, source-of-truth repo, migration pattern, repeated project task, or external skill example into a pi-native skill. First gather the right context, classify the skill type, design the proper structure, and then generate the appropriate SKILL.md, references, scripts, assets, and supporting files.
---

# Pi Skill Creator

Create and refine skills tailored for **pi** and this **pi.dev** repository.

Do not jump straight into writing `SKILL.md`. First understand the requested skill, gather authoritative context, extract the repeatable workflow, and then generate the right package.

## Core process

1. Gather requirements and authoritative context.
2. Classify the skill type.
3. Build a design brief.
4. Review the brief with the user when the task is non-trivial.
5. Draft the skill package.
6. Refine, finalize, and optionally commit/push.

## What this skill should produce

A finished or improved skill under `pi/skills/<category>/<skill-name>/` in `~/Developer/pi.dev` by default, unless the user explicitly asks for a project-local skill elsewhere. It should:

- follow the pi / Agent Skills format
- use a valid lowercase hyphenated `name`
- keep the `name` equal to the parent directory name
- have a strong `description` that clearly says what the skill does and when to use it
- include extra files only when they add real value
- fit pi.dev conventions and categories
- reflect real source-of-truth context instead of placeholder guidance

## Pi-native operating rules

1. Read local patterns first: `pi/skills/README.md`, nearby skills in the same category, and relevant pi docs.
2. If the skill touches pi features, read the relevant pi docs before drafting instructions.
3. If the user points to an external repo or skill, study it first and adapt it to pi instead of copying it literally.
4. Default the generated reusable skill destination to `~/Developer/pi.dev/pi/skills/...`.
5. Treat external repos as source context by default, not as the destination, unless the user explicitly asks for a project-local skill.
6. Update `pi/skills/README.md` when adding a new category or notable new skill.
7. Never hardcode secrets. Reference environment variables only.
8. After creating or updating a skill in pi.dev, remind the user about `./scripts/setup.sh` and `/reload`.
9. If the user asks, commit and push the pi.dev changes using Conventional Commits.

## Skill classes

Classify the request before drafting.

### 1. Helper skill
Small reusable behavior, formatting guidance, or lightweight instruction set.

Typical output:
- `SKILL.md` only

### 2. Workflow skill
Step-by-step operational process.

Typical output:
- `SKILL.md`
- optional `references/`

### 3. Migration or adoption skill
Moves a project from one state to another.

Typical output:
- `SKILL.md`
- `references/` for decision trees, patterns, edge cases, validation
- optional `assets/`

### 4. Repo-specific operational skill
Teaches pi how to correctly use a source-of-truth repo, framework, component, or org-standard workflow.

Typical output:
- `SKILL.md`
- `references/` that distill the source repo
- optional `scripts/` or `assets/`

If unclear, ask enough questions to classify the skill first.

## Workflow

### 1. Capture the target skill
Clarify:

- what the skill should enable pi to do
- when it should trigger
- whether it creates, updates, migrates, reviews, or standardizes something
- whether it is tied to a specific repo, framework, platform, or internal standard
- what success looks like

Reuse context already present in the conversation before asking repetitive questions.

### 2. Gather authoritative context
Use the right source material before writing:

- source-of-truth repos
- local repository files
- existing pi skills
- pi documentation
- examples and templates
- external skills or docs the user referenced

If the user points to another repository, treat it as context to study first. For pi.dev authoring workflows, still create the resulting skill under `~/Developer/pi.dev/pi/skills/...` unless the user clearly asks for a project-local skill.

If web context is needed, use the `brave-search` skill.

### 3. Build a design brief
Before generating files, synthesize what you learned into a compact design brief that covers:

- skill type
- audience or target repo/context
- trigger conditions
- inputs inspected
- outputs or changes produced
- decisions and edge cases
- validation needs
- file structure
- destination path

For pi.dev-centered workflows, explicitly note that the destination is `pi/skills/...` in `~/Developer/pi.dev` unless the user requested a different destination.

### 4. Review the brief with the user when needed
For migration skills, repo-specific operational skills, or anything based on a source-of-truth repo, present the design brief before finalizing files.

Confirm at least:

- skill name and category
- destination path
- trigger conditions
- expected structure
- assumptions or risky gaps

If the user is still shaping the skill, pause for confirmation before drafting the full package.

### 5. Draft the skill package
Create instructions that are practical, pi-native, and actionable.

Preferred sections include:

- purpose
- when to use
- workflow
- decision rules
- validation steps
- repo-specific notes
- references to bundled files

Write for an agent. Be direct and concise.

Optimize `SKILL.md` for activation, not documentation. Keep only the material the agent needs on nearly every run:

- what the skill does
- when to use it
- hard rules or boundaries
- core workflow
- output contract
- short validation summary
- links to references

Move long checklists, examples, edge cases, migration patterns, source-of-truth summaries, and detailed manual procedures into `references/`.

### 6. Run a trim pass before finalizing
Before you finish any non-trivial skill, do an explicit compression pass.

Ask:

- what must stay in `SKILL.md` every time?
- what can move into `references/`?
- what is repetitive?
- what is example or edge-case material rather than operational guidance?
- what would still work if this section were half as long?

Default line-budget targets:

- helper skills: 60-120 lines
- workflow skills: 80-150 lines
- migration or repo-specific skills: 120-180 lines

If a draft goes beyond its target, shorten it aggressively or move material into `references/`. Only exceed the range when the extra length is clearly necessary for reliable execution.

### 7. Adapt external material instead of copying it
When the user gives an external skill, article, or repo:

1. read it fully
2. extract the useful workflow and concepts
3. strip harness-specific behavior that does not fit pi
4. rewrite examples, paths, and tooling to match pi.dev
5. preserve the useful idea, but make the result feel native to pi

### 8. Validate before finishing
Check that:

- the skill name is valid and matches the directory
- the description is explicit enough to trigger reliably
- the structure matches the skill class
- references and scripts are only included when useful
- instructions match pi, not another harness
- repo paths mentioned in the skill actually exist
- the destination repo is correct for the user's workflow
- no security or secret-handling rules are violated

### 9. Finish the pi.dev workflow
When the generated skill is added to `pi.dev`:

1. summarize what was created or changed
2. update `pi/skills/README.md` if needed
3. if the user asks, commit the changes with a Conventional Commit
4. if the user asks, push the branch
5. remind the user to run `./scripts/setup.sh` and `/reload`

## Description guidance

The description is the main trigger surface. Make it say both what the skill does and when to use it.

Use this default pattern:

- first sentence: what the skill does
- second sentence: `Use when ...`

For deeper guidance, see [references/description-guide.md](references/description-guide.md).

## Structure guidance

Start with the smallest structure that works.

Keep in `SKILL.md` only the activation-time essentials:

- purpose
- when to use
- hard rules or boundaries
- workflow
- output contract
- short validation summary
- links to references

Move examples, long checklists, migration patterns, edge cases, source-of-truth summaries, and detailed manual procedures into `references/`.

For heuristics on when to add `references/`, `scripts/`, or `assets/`, see [references/structure-guide.md](references/structure-guide.md).

For a reusable starter template, see [references/scaffold-template.md](references/scaffold-template.md).

## Pi-specific checklist

Before finishing, confirm:

- the skill lives under `~/Developer/pi.dev/pi/skills/` by default unless the user requested project-local placement
- frontmatter is valid
- the directory name and `name` match exactly
- the description is explicit enough to trigger reliably
- extra files are referenced with relative paths
- `pi/skills/README.md` was updated if needed
- the user is reminded about `./scripts/setup.sh` and `/reload`
- the user is asked whether they want commit and push in `pi.dev`

For a reusable review checklist, see [references/pi-skill-checklist.md](references/pi-skill-checklist.md).
