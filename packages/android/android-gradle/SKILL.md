---
name: android-gradle
description: Build, test, and manage Android projects using Gradle. Use for running builds, executing tests, checking dependencies, and managing version catalogs.
---

# Android Gradle Skill

This skill helps automate Android build tasks.

## Requirements

- `gradle` or `./gradlew` must be available in the project root.

## Usage

### Run a Build
```bash
./gradlew assembleDebug
```

### Run Unit Tests
```bash
./gradlew test
```

### Run Lint
```bash
./gradlew lint
```

### List Dependencies
```bash
./gradlew app:dependencies
```

### Update Dependencies
Use the agent to modify `build.gradle.kts` or `libs.versions.toml`.

## Safe Build Workflow (Build & Rollback)

When making changes to build files (`build.gradle.kts`, `libs.versions.toml`), use this safety-first approach:

1.  **Snapshot**: Ensure current changes are committed or stashed.
2.  **Apply Change**: Modify the build file.
3.  **Test Build**: Run `./gradlew assembleDebug` (or a relevant task).
4.  **Validate**:
    - If **Success**: Keep changes.
    - If **Failure**: 
        - Capture the error log.
        - **Rollback** changes (e.g., `git checkout path/to/file` or `undo`).
        - Analyze the error and try a different approach.

### Automated Check Command
```bash
./gradlew assembleDebug || (echo "BUILD FAILED - ROLLING BACK" && git checkout .)
```
