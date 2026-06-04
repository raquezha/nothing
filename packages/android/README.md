# android (Android & Kotlin Development Toolkit)

Specialized skills and prompt helpers optimized for Kotlin Multiplatform (KMP), Compose Multiplatform, and Android development.

## 🛠 Skills Checklist

This package exposes the following Android skills:

- **`android-adb`**: Connect, debug, install apks, and manage connected devices and emulators.
- **`android-agp9-migration`**: Automated migrator for upgrading projects to Android Gradle Plugin (AGP) 9.x rules.
- **`android-compose`**: Code generators and visual templates for Jetpack Compose UI components.
- **`android-gradle`**: Dependency managers and version catalog (`libs.versions.toml`) alignment checks.
- **`android-logcat-smart`**: Smart filters for parsing long logcat stacks to locate crashes and memory leaks.
- **`android-project-setup`**: Seeds clean Android architectures matching Kotlin, Gradle, and Android guidelines.
- **`android-ci-component-adoption`**: Setup templates and check-off scripts for standard GitLab or GitHub CI builds.

---

## 🚀 Usage

Load this toolkit dynamically by launching the agent with the Android flag:

```bash
pi --android
```

Or target specific skills in your prompt:
```text
/android-logcat-smart
```

For logcat analysis, copy-paste the raw crash trace and invoke:
```text
Analyze this crash stack: [paste stack]
```
