---
name: android-project-setup
description: Initialize and configure new Android projects or modules. Use for creating new modules, adding common dependencies, and setting up base configurations.
---

# Android Project Setup Skill

This skill assists in the initial setup and modularization of Android projects.

## Usage

### Create New Module
The agent can generate the directory structure and `build.gradle.kts` for a new module.

### Add Hilt Support
```bash
/skill:android-project-setup add hilt
```

### Add Compose to Existing Module
The agent will update `build.gradle.kts` with the necessary Compose dependencies and compiler options.

## Templates

- **Standard Library Module**: Clean architecture data/domain layers.
- **Compose Feature Module**: UI layer with Compose dependencies.
- **Hilt/Dagger Setup**: Dependency injection boilerplate.
