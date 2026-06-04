---
name: android-adb
description: Interact with Android devices and emulators using ADB (Android Debug Bridge). Use for installing APKs, viewing logs, taking screenshots, and executing shell commands on devices.
---

# Android ADB Skill

This skill provides a set of commands to interact with connected Android devices.

## Requirements

- `adb` must be installed and in your PATH.

## Usage

### List Devices
```bash
adb devices
```

### Install APK
```bash
adb install path/to/your.apk
```

### View Logs
```bash
adb logcat
```

### Take Screenshot
```bash
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png .
```

### Record Video
```bash
adb shell screenrecord /sdcard/video.mp4
# ... stop with Ctrl+C or timeout ...
adb pull /sdcard/video.mp4 .
```

### Send Intent
```bash
adb shell am start -a android.intent.action.VIEW -d "https://developer.android.com"
```
