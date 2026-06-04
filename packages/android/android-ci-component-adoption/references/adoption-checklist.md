# Adoption checklist

Use this checklist when auditing or migrating a consumer repo.

## 1. Identify the target template

- [ ] Android mobile app → `android-mobile`
- [ ] Android TV app → `android-tv`
- [ ] KMP app with Android module → `kmp`
- [ ] Not actually an app repo? Consider artifact/toolbox templates instead

## 2. Inspect repository structure

- [ ] `.gitlab-ci.yml` exists
- [ ] `settings.gradle` or `settings.gradle.kts` includes the real app module
- [ ] Main Android module uses `app-*`
- [ ] KMP repo has a shared module if `kmp` is selected
- [ ] `version.properties` exists in repo root or agreed path

## 3. Inspect CI include style

- [ ] Uses `component:` with valid `inputs:` keys when Catalog usage is intended
- [ ] Or uses `project:` include while testing unpublished changes
- [ ] No invalid or undocumented input keys
- [ ] No conflicting top-level variables that silently override desired inputs
- [ ] Platform-specific inputs use current names such as `enable_desktop_macos`, not stale variants

## 4. Inspect Gradle versioning

- [ ] App build script reads `versionCode` and `versionName` from Gradle properties first
- [ ] Falls back to `version.properties` for local development
- [ ] Release builds fail fast when version info is missing
- [ ] No legacy ad-hoc version increment logic remains

## 5. Inspect product flavors

For Android mobile and KMP Android paths:
- [ ] `review` flavor exists
- [ ] `staging` flavor exists
- [ ] `production` flavor exists
- [ ] Non-production flavors use application ID suffixes as needed

## 6. Inspect signing

- [ ] Build script uses two-tier lookup for `keystore.properties`
- [ ] `STORE_FILE` is resolved relative to the properties file location
- [ ] No `System.getenv()`-based signing fallback is reintroduced
- [ ] Repo instructions clearly defer secret setup to GitLab Secure Files

## 7. Inspect GitLab runtime expectations

- [ ] `GITLAB_PACKAGE_REGISTRY` requirement is documented or already provisioned
- [ ] `PACKAGE_NAME` is present when Play/Firebase flows need it
- [ ] `GOOGLE_PLAY_SERVICE_ACCOUNT` expectation is documented when Play validation or deploy is required
- [ ] Firebase tester groups and service account files are documented when applicable
- [ ] `CI_JOB_TOKEN` push permission requirement is documented
- [ ] `android_image` or `ANDROID_IMAGE` override is called out when the repo needs a different JDK

## 8. Inspect KMP extras when enabled

- [ ] `shared_module` matches repo layout
- [ ] `enable_ios` only if iOS project and credentials exist
- [ ] `enable_desktop_macos` only if desktop packaging path exists
- [ ] `mac-shell` prerequisite is called out for iOS/Desktop

## 9. Inspect high-risk override traps

- [ ] Stale GitLab UI variables are not overriding `APP_MODULE`, `RUNNER_TAG`, `PLAY_STORE_RELEASE_TRACK`, `ENABLE_DRY_RUN`, `ANDROID_IMAGE`, or `GOOGLE_SERVICES_JSON_PATH`
- [ ] Job-level overrides are intentional and documented
- [ ] Toolchain requests match the chosen Android image

## 10. Separate manual GitLab work from repo work

- [ ] Remaining Secure Files actions are listed separately
- [ ] Remaining CI/CD variable actions are listed separately
- [ ] Required project settings changes are listed separately
- [ ] Runner prerequisites are listed separately
- [ ] Safe confirmation guidance avoids requesting secrets

## 11. Final deliverable to the user

- [ ] Summary of what already matches the component standard
- [ ] Summary of gaps that require repo code changes
- [ ] Summary of gaps that require GitLab UI or Secure Files configuration
- [ ] Ordered migration plan
- [ ] Validation steps the user should run next
- [ ] Explicit completion state
