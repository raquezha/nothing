---
name: android-ci-component-adoption
description: Inspect, migrate, and validate Android mobile, Android TV, or KMP repositories so they adopt the android-team/v3/devops/ci-component GitLab CI component correctly. Use when onboarding a repo, auditing CI usage, repairing drift, or updating .gitlab-ci.yml, Gradle files, version.properties, flavors, signing, and GitLab setup expectations.
---
# Android CI Component Adoption
Use this skill to inspect, migrate, and validate Android mobile, Android TV, and KMP repositories against the shared GitLab CI component from `android-team/v3/devops/ci-component`.

Do not jump straight into editing `.gitlab-ci.yml`. Inspect the repo first, classify the platform, identify drift from the source of truth, then apply only the changes needed.

## When to use
Use this skill when the user wants to:
- adopt the shared CI component in a repo
- migrate from custom or legacy GitLab CI to the shared templates
- audit whether a repo is configured correctly
- repair drift after template, variable, project-structure, or release-process changes
- update Android/KMP project structure so the CI templates can work
- fix issues around `version.properties`, `app-*` modules, flavors, signing, include style, or GitLab variable behavior
- decide whether a repo should use `android-mobile`, `android-tv`, or `kmp`

## Hard rules
- Treat `android-team/v3/devops/ci-component` as the source of truth.
- Re-read relevant docs or templates when the repo shape is ambiguous.
- Separate **repo changes** from **manual GitLab / Secure Files / runner actions**.
- Never read or expose secrets. Do not open protected files such as real keystores, `.env`, or credentials.
- Prefer small, explicit migrations over broad speculative rewrites.
- If the repo is not clearly an app repo, check whether artifact/toolbox templates are the better fit.
- Never claim adoption is complete when blocking GitLab-side setup is still pending.

## Manual boundary
This skill can prepare repo code and CI configuration, but it cannot perform privileged manual work outside the repository.

### The skill can do
- inspect repo structure and classify the platform
- audit `.gitlab-ci.yml` include style and adoption drift
- patch repo files such as `.gitlab-ci.yml`, `settings.gradle(.kts)`, `version.properties`, and Gradle build files
- normalize version injection, flavors, and signing lookup code
- identify likely GitLab UI variable override problems
- produce a migration plan and manual handoff checklist

### The skill cannot do
- upload Secure Files
- create, edit, or reveal CI/CD variables in GitLab UI
- enable project settings such as **Allow Git push requests**
- change runner registration, tags, or permissions
- verify real credentials by opening protected files
- declare deployment-ready success when manual setup is still missing

When manual work is required, report it separately with the action, likely owner, blocker level, and safe confirmation method. Use [references/manual-gitlab-actions.md](references/manual-gitlab-actions.md) for the detailed handoff pattern.

## First response contract
Before editing, give the user a compact adoption assessment:
1. detected repo type
2. recommended template
3. main adoption gaps
4. work type: audit only, partial migration, full migration, or drift repair
5. whether the repo is blocked by manual GitLab setup

Skip this only if the user explicitly asks for a direct rewrite.

## Core workflow
### 1. Classify the repo
Determine whether the repo is:
- Android mobile app
- Android TV app
- KMP app with Android module
- non-app/library repo

Inspect the repo entry points first, especially:
- `.gitlab-ci.yml`
- `settings.gradle` / `settings.gradle.kts`
- app module names
- presence of `shared/`, `iosApp/`, or desktop modules
- current CI includes, variables, and Android-specific build setup

### 2. Choose the template
Map the repo to one primary template:
- Android mobile → `android-mobile`
- Android TV → `android-tv`
- KMP app → `kmp`
- library/toolbox case → stop and recommend artifact templates instead of forcing an app migration

Use [references/migration-patterns.md](references/migration-patterns.md) for include strategy and template-selection details.

### 3. Audit before editing
Audit the repo against the required conventions:
- app module naming
- `version.properties`
- Gradle version injection
- flavors for Android mobile / KMP Android
- signing lookup
- `.gitlab-ci.yml` include style
- runtime assumptions and required GitLab-side setup
- override traps between `inputs:`, YAML `variables:`, and GitLab UI variables
- toolchain fit, especially `android_image` / `ANDROID_IMAGE`
- platform-specific fit for TV and KMP extras

Use [references/adoption-checklist.md](references/adoption-checklist.md) as the baseline.

### 4. Choose include style deliberately
Prefer `component:` plus `inputs:` when the published component is the intended path.

Use `project:` include temporarily when:
- Catalog publication is not available yet
- the user needs a direct branch or repo reference
- Catalog input validation would block a safe migration

Remember:
- `inputs:` are lowercase snake_case
- runtime variables are UPPERCASE
- GitLab UI variables can silently override both mapped inputs and YAML variables

### 5. Apply repo changes in order
Use this migration order unless the repo needs a narrower fix:
1. fix app module naming and `settings.gradle*`
2. create or repair `version.properties`
3. patch Gradle version injection
4. patch signing lookup
5. add or repair flavors for Android mobile / KMP Android
6. update `.gitlab-ci.yml` include and inputs
7. document remaining GitLab UI, Secure Files, settings, and runner actions

### 6. Produce the manual handoff
If any GitLab-side work remains, separate it into:
- Secure Files
- CI/CD variables
- project settings
- runner prerequisites
- safe validation requests

Do not blend those tasks into repo-complete language.

## Completion states
Use one of these states explicitly:
- **audit complete**
- **repo migration complete**
- **manual GitLab setup required**
- **validation pending human setup**
- **adoption complete**

Reserve **adoption complete** for cases where both repo work and blocking manual setup are finished.

## Output contract
When reporting back, always separate results into:
1. **What I inspected**
2. **What I changed**
3. **Manual GitLab actions required**
4. **How to verify the manual actions safely**
5. **Risks, blockers, or follow-up checks**
6. **Current completion state**

If no changes were made, still provide the recommended template, adoption status, exact blockers, and next safe step.

## Short validation
After editing, validate what can be validated locally:
- `.gitlab-ci.yml` include structure and keys are coherent
- `version.properties` has the required keys
- app module naming and Gradle includes are aligned
- Gradle snippets are internally consistent
- manual GitLab actions are listed separately from repo edits

If the repo contains YAML linting or CI validation commands, suggest running them.

## References
- [Design brief](references/design-brief.md)
- [Source-of-truth summary](references/source-of-truth-summary.md)
- [Adoption checklist](references/adoption-checklist.md)
- [Migration patterns](references/migration-patterns.md)
- [Manual GitLab actions](references/manual-gitlab-actions.md)
