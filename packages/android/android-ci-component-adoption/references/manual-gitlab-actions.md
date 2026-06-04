# Manual GitLab actions

Use this reference when the repo migration depends on GitLab UI, Secure Files, runner, or permission work that the agent cannot perform directly.

## Rule

Do not present these as completed by the agent. Present them as human-owned follow-up work.

For every manual action, report:
- the required action
- likely owner
- blocker level
- safe confirmation method

## 1. Secure Files

Typical actions:
- upload the release keystore binary
- upload `keystore.properties`
- upload Firebase service account files when the template expects them

Likely owner:
- Project Maintainer
- Release Engineer

Blocker level:
- blocks signed release builds
- may block Firebase deploy jobs

Safe confirmation methods:
- confirm the required filenames exist in **Settings → CI/CD → Secure Files**
- confirm `keystore.properties` exists without pasting its contents
- confirm the uploaded keystore filename matches `STORE_FILE` without revealing passwords
- provide redacted screenshots if needed

Never ask for:
- keystore contents
- `keystore.properties` secret values
- service account JSON contents

## 2. CI/CD variables

Typical actions:
- add `GITLAB_PACKAGE_REGISTRY`
- add `PACKAGE_NAME`
- add `GOOGLE_PLAY_SERVICE_ACCOUNT` when Play validation or deploy is required
- add Firebase tester variables when Firebase distribution is used
- add optional AI variables only when AI release notes are intentionally enabled

Likely owner:
- Project Maintainer
- DevOps
- Release Engineer

Blocker level:
- may block dependency resolution, Play deploy, Firebase deploy, or release-note features

Safe confirmation methods:
- confirm variable names only
- confirm masking/protection settings
- confirm whether the variable is inherited from the group or defined at project level
- confirm whether a stale variable was removed or updated

Never ask for:
- raw token values
- JSON credential bodies
- passwords or secret screenshots

## 3. Project settings

Typical actions:
- enable **Settings → CI/CD → Job token permissions → Allow Git push requests**
- verify protected branch or approval settings if the release flow depends on them
- verify CI/CD Catalog or component publish settings only when relevant to source-of-truth work

Likely owner:
- Project Maintainer
- GitLab Admin

Blocker level:
- can block release branch or tag push operations

Safe confirmation methods:
- yes/no confirmation from the maintainer
- redacted screenshot of the setting page
- masked pipeline logs showing the error disappeared

## 4. Runner prerequisites

Typical actions:
- confirm `universal-android` is available to the project
- confirm `mac-shell` is available before enabling KMP iOS or desktop macOS jobs
- confirm the runner environment supports the intended JDK or image strategy

Likely owner:
- DevOps
- GitLab Admin

Blocker level:
- can block the entire pipeline or optional platform paths

Safe confirmation methods:
- confirm tag availability
- confirm runner type only
- confirm host capability without exposing credentials or machine-sensitive data

## 5. Variable override cleanup

Typical actions:
- remove stale GitLab UI variables overriding `APP_MODULE`
- remove stale GitLab UI variables overriding `RUNNER_TAG`
- remove stale GitLab UI variables overriding `PLAY_STORE_RELEASE_TRACK`
- remove stale GitLab UI variables overriding `ANDROID_IMAGE`
- remove stale GitLab UI variables overriding `GOOGLE_SERVICES_JSON_PATH`

Likely owner:
- Project Maintainer
- DevOps

Blocker level:
- can silently invalidate an otherwise correct repo migration

Safe confirmation methods:
- confirm variable name removed or updated
- compare current `.gitlab-ci.yml` intent against the UI variable list without exposing secret values

## 6. Suggested response format

When manual work remains, use a structure like this:

### Manual GitLab actions required
- **Secure Files — Project Maintainer — blocking release**
  - upload keystore binary
  - upload `keystore.properties`
- **CI/CD variables — Project Maintainer — blocking Play deploy**
  - confirm `GOOGLE_PLAY_SERVICE_ACCOUNT` exists as Protected + Masked
- **Project settings — Project Maintainer — blocking git push from CI**
  - enable `Allow Git push requests`
- **Runner prerequisites — DevOps — blocks optional KMP iOS path**
  - confirm `mac-shell` runner is available

### How to verify safely
- confirm filenames and variable names only
- share redacted screenshots if needed
- share masked pipeline errors, not secrets

## 7. Completion language

Use these meanings consistently:

- **repo migration complete** — repo files are updated
- **manual GitLab setup required** — human work still remains
- **validation pending human setup** — agent cannot fully validate until humans finish the manual tasks
- **adoption complete** — repo work and blocking manual GitLab work are both finished
