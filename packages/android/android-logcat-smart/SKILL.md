---
name: android-logcat-smart
description: Captures and analyzes Android Logcat output to identify crashes, ANRs, and logical errors. Provides "Smart Synthesis" by suggesting potential fixes based on stack traces.
---

# Smart Logcat Skill

Use this skill to debug running applications. It goes beyond simple log viewing by focusing on error identification and resolution.

## Usage

### Analyze Recent Crashes
```bash
adb logcat -d *:E | tail -n 100
```
*Agent Instruction: Read the output above, identify the exception type (e.g., NullPointerException, IllegalStateException), and locate the offending line in the source code.*

### Monitor Specific Package
```bash
adb logcat --pid=$(adb shell pidof -s <package_name>)
```

### Logcat Synthesis Workflow
1.  **Capture**: Run `adb logcat -d`.
2.  **Filter**: Look for `FATAL EXCEPTION` or `System.err`.
3.  **Synthesize**:
    - Identify the **Root Cause**.
    - Check **Source Code** at the reported line.
    - Suggest a **Potential Fix**.

## Common Error Patterns

- **NullPointerException**: Check if a variable was initialized or if a nullable type was used incorrectly.
- **Resources$NotFoundException**: Verify if the resource ID exists in all relevant configuration folders (values, values-night, etc.).
- **WindowManager$BadTokenException**: Usually related to showing a Dialog after an Activity has been destroyed.
- **SQLiteException**: Check for migration issues or incorrect column names in Room/SQLite.
