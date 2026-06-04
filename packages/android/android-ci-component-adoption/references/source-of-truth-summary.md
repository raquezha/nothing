# Source-of-truth summary

This skill is based on the `android-team/v3/devops/ci-component` repository.

## Canonical template choices

- `templates/android-mobile/template.yml` — Android mobile apps
- `templates/android-tv/template.yml` — Android TV apps
- `templates/kmp/template.yml` — KMP apps with Android support
- `templates/artifacts/*.yml` — library publishing, not the default path for app repos

## Core adoption rules

### 1. App module naming

Android app modules must use the `app-*` naming pattern.

Examples:
- `app-hapidee`
- `app-mytv`
- `app-mykmp`

`APP_NAME` is derived by stripping `app-`.

### 2. version.properties is mandatory

Required keys:

```properties
versionMajor=1
versionMinor=0
versionPatch=0
lastVersionCode=1
lastProductionVersionCode=1
```

This file is the canonical source of truth for version numbers.

### 3. Platform flavors

For Android mobile and KMP Android app flows, the CI expects:

- `review`
- `staging`
- `production`

Do not rename these if the repo is adopting the standard jobs.

### 4. Signing model

Release signing must use GitLab Secure Files:

- keystore binary
- `keystore.properties`

Gradle should read `STORE_FILE` from `keystore.properties` using a two-tier lookup:
- module-local file first
- repo-root fallback second

### 5. CI include style

Preferred for published Catalog usage:

```yaml
include:
  - component: gitlab.nweca.com/android-team/v3/devops/ci-component/android-mobile@~latest
    inputs:
      app_module: app-myapp
```

Safe fallback while testing unpublished changes or bypassing Catalog input validation:

```yaml
include:
  - project: 'android-team/v3/devops/ci-component'
    file: '/templates/android-mobile/template.yml'
    ref: 'main'
```

### 6. Inputs vs variables

- Use `inputs:` for published platform components
- Use `variables:` for runtime env vars and for local/project include patterns
- Platform templates map inputs directly into environment variables
- GitLab UI variables can silently override both `inputs:` and YAML `variables:`

Effective precedence:

```text
GitLab UI variables > job-level variables > pipeline variables > mapped inputs > spec defaults
```

High-risk override targets include:
- `APP_MODULE`
- `RUNNER_TAG`
- `PLAY_STORE_RELEASE_TRACK`
- `ENABLE_DRY_RUN`
- `ANDROID_IMAGE`
- `GOOGLE_SERVICES_JSON_PATH`

### 7. Runner defaults

Canonical runner pool for Android/KMP work is:

- `RUNNER_TAG=universal-android`

Platform templates map `runner_tag` input into `RUNNER_TAG`.

KMP iOS and desktop macOS paths need a real `mac-shell` runner.

### 8. Key GitLab variables

Common repo/runtime requirements:

- `GITLAB_PACKAGE_REGISTRY` — required for Gradle dependency resolution; Masked, not Protected
- `PACKAGE_NAME` — production base package name for flavor-aware Firebase/Play flows
- `GOOGLE_PLAY_SERVICE_ACCOUNT` — protected + masked for Play validation/deploy when required
- `FIREBASE_REVIEW_TESTERS`, `FIREBASE_STAGING_TESTERS`, `FIREBASE_PRODUCTION_TESTERS` — when Firebase distribution is used
- `AI_PROVIDER`, `AI_API_KEY`, `ENABLE_AI_RELEASE_NOTES` — optional release notes path

### 9. Git push behavior

Platform templates prefer `CI_JOB_TOKEN`.

Consumer repos must enable:
- **Settings → CI/CD → Job token permissions → Allow Git push requests**

### 10. Java toolchain rule

Default Android image is pinned around JDK 21. If the repo requests another Java toolchain, override `android_image` or `ANDROID_IMAGE` to a compatible image instead of relying on Gradle toolchain auto-download.

### 11. Current useful platform inputs

Commonly relevant current inputs include:
- `app_module`
- `runner_tag`
- `android_image`
- `gradle_options`
- `enable_dry_run`
- `play_store_release_track`
- `version_util_ref`
- `version_util_version`

Android mobile also exposes:
- `google_services_json_path`

KMP also exposes:
- `shared_module`
- `enable_ios`
- `enable_desktop_macos`

Android TV also exposes:
- `enable_collision_check`

### 12. Android TV specifics

Android TV relies on Play tracks, not Firebase App Distribution as the main QA model. Do not force mobile-only Firebase assumptions onto TV repos.

`enable_collision_check` is optional and defaults false for TV.

### 13. Manual boundary

The agent can prepare repo code for adoption, but the following remain manual human tasks:
- Secure Files uploads
- CI/CD variable creation and editing
- project settings changes
- runner provisioning and permission changes

The skill should report these separately and ask only for safe confirmation, never secret contents.
