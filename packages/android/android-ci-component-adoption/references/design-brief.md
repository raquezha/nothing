# Design brief — android-ci-component-adoption

## Skill class

Repo-specific operational skill with migration/adoption behavior.

## Applies to

- Android mobile app repositories
- Android TV repositories
- Kotlin Multiplatform repositories with an Android app module
- Adjacent mobile repos that need to inspect or migrate their GitLab CI usage to `android-team/v3/devops/ci-component`

## Trigger moments

Use this skill when the user wants to:

- onboard a repo to the shared CI component
- inspect whether a repo is configured correctly
- migrate from legacy `.gitlab-ci.yml` logic to the shared component
- repair a broken adoption after template, variable, or project-structure drift
- prepare Android, Android TV, or KMP repos for review/staging/production flows
- separate repo automation work from manual GitLab setup work

## Source-of-truth studied

This skill was designed from the local source repo contents, especially:

- `AGENTS.md`
- `templates/README.md`
- `templates/android-mobile/template.yml`
- `templates/android-tv/template.yml`
- `templates/kmp/template.yml`
- `docs/template-usage.md`
- `docs/inputs-vs-variables.md`
- `docs/ci-variables.md`
- `docs/android-mobile-quickstart.md`
- `docs/android-tv-quickstart.md`
- `docs/kmp-quickstart.md`

## What the skill inspects

1. Repository type
   - Android mobile
   - Android TV
   - KMP
   - library/toolbox false positives
2. CI entrypoint
   - `.gitlab-ci.yml`
   - include style: `component:`, `project:`, or `local:`
3. Module conventions
   - main Android module must use `app-*`
   - KMP shared module detection
4. Versioning
   - `version.properties` existence and required keys
   - Gradle version injection pattern
5. Flavors
   - `review`, `staging`, `production` for Android mobile and KMP Android path
6. Signing
   - Gradle two-tier `keystore.properties` lookup
   - Secure Files expectations
7. CI variables and runtime assumptions
   - `GITLAB_PACKAGE_REGISTRY`
   - `PACKAGE_NAME`
   - `GOOGLE_PLAY_SERVICE_ACCOUNT`
   - Firebase tester groups and service accounts when applicable
   - `CI_JOB_TOKEN` push permission expectation
8. Release behavior risks
   - `inputs:` vs `variables:` precedence
   - stale GitLab UI variables silently overriding repo config
   - Java toolchain / `ANDROID_IMAGE` mismatches
   - wrong KMP input names such as desktop toggles

## What the skill should produce

Depending on the request:

- an audit of current adoption gaps
- a migration plan ordered by risk
- direct code changes to `.gitlab-ci.yml`, Gradle files, and `settings.gradle.kts`
- creation or repair of `version.properties`
- a separate manual handoff for GitLab UI, Secure Files, settings, and runner tasks
- validation notes and follow-up checks
- an explicit completion state

## Decisions the skill must make

- Which platform template fits: `android-mobile`, `android-tv`, or `kmp`
- Whether to prefer `component:` or temporary `project:` include usage
- Whether repo variables should stay in `inputs:` or `variables:`
- Whether the repo already follows the required module, flavor, and signing conventions
- Whether missing pieces are code changes or GitLab settings changes
- Whether remaining work blocks audit only, migration completion, or full adoption

## Important edge cases

- Repo uses `app/` instead of `app-*`
- Repo lacks `review/staging/production` flavors
- KMP repo enables iOS/Desktop without required mac-shell prerequisites
- Existing GitLab UI variables silently override intended `inputs:` values
- Repo requests a Java toolchain not present in the default Android image
- TV repos should not be migrated to Firebase-centric mobile flows
- Sensitive files such as `keystore.properties` may be referenced but must not be read if protected by policy
- Manual GitLab work exists but the user expects the agent to finish it directly

## Validation expected

- `.gitlab-ci.yml` include and variable shape matches chosen template
- `version.properties` contains all required keys
- Gradle files accept CI-injected `versionCode` and `versionName`
- signing lookup uses `STORE_FILE` from `keystore.properties`
- Android/KMP app module name follows `app-*`
- instructions clearly separate repo changes from GitLab UI / Secure Files actions
- remaining manual tasks are listed with safe verification guidance

## Chosen package structure

```text
android-ci-component-adoption/
├── SKILL.md
└── references/
    ├── adoption-checklist.md
    ├── design-brief.md
    ├── manual-gitlab-actions.md
    ├── migration-patterns.md
    └── source-of-truth-summary.md
```

References are included because this skill needs stable decision rules, distilled source-of-truth constraints, a reusable audit checklist, and a clear boundary around manual GitLab work.
