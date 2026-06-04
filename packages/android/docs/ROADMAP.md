# Android Agent Skills Implementation Plan

This document outlines the strategy for integrating specialized Android development skills into the `pi` agent.

## Goals
1.  **Speed**: Accelerate common Android tasks (build, deploy, test) by 3x.
2.  **Accuracy**: Use specialized skills to reduce errors in ADB commands and Gradle configurations.
3.  **Discovery**: Provide a clear list of available capabilities to the user.

## Implementation Phases

### Phase 1: Core Tooling (Current)
- [x] `android-adb`: Device interaction.
- [x] `android-gradle`: Build system management with **Build & Rollback** safety.
- [x] `android-compose`: UI development patterns.
- [x] `android-logcat-smart`: **Smart Synthesis** for crash analysis.

### Phase 2: Project Management
- [ ] `android-manifest`: Permission and component management.
- [ ] `android-resources`: Localized strings, colors, and asset management.
- [ ] `android-versions`: Version catalog (`libs.versions.toml`) management and updates.

### Phase 3: Testing & Quality
- [ ] `android-test`: Unit and UI test automation (Espresso/Compose Test).
- [ ] `android-lint`: Automatic fixing of lint issues.
- [ ] `android-perf`: Performance profiling and analysis.

### Phase 4: Release & Publishing
- [ ] `android-bundle`: App Bundle creation and analysis.
- [ ] `android-play`: Play Store metadata and release management.

## Available Skills (Reference)

| Skill Name | Description |
| :--- | :--- |
| `android-adb` | ADB commands, logcat, screenshots, intent firing. |
| `android-logcat-smart` | Crash analysis and "Smart Synthesis" of fixes. |
| `android-gradle` | Build, test, lint, with Build & Rollback safety. |
| `android-compose` | Jetpack Compose UI generation and refactoring. |
| `android-ci-component-adoption` | Audit, classify, and migrate Android, Android TV, and KMP repos to the shared ci-component GitLab CI standard. |
| `android-manifest` | Manifest analysis and modification. |
| `android-resources` | Resource management (strings, colors, drawables). |
| `android-test` | Test execution and result analysis. |
| `android-lint` | Static analysis and issue remediation. |
| `android-studio` | IDE integration and project sync. |
| `android-emulator` | AVD management. |
| `android-perf` | Performance analysis. |

## Usage
Skills are automatically discovered by `pi` from `pi/skills/`. You can force load a skill using `/skill:<name>`.

Example:
`/skill:android-adb list devices`
