# Description Guide

The description is the main trigger surface for a skill.

## Goal

Make it obvious:

1. what the skill does
2. when the agent should load it

## Recommended format

Use two sentences:

1. what the skill does
2. `Use when ...`

Example:

```yaml
description: Adopt, migrate, and validate usage of a shared CI component in Android and Kotlin Multiplatform repositories. Use when the user wants to set up CI, replace legacy pipeline configuration, fix incorrect component usage, or align a mobile repo with the canonical CI standard.
```

## Good patterns

- name the capability clearly
- include trigger phrases the user may actually say
- mention the target repo, framework, file type, or workflow when relevant
- use concrete wording

## Avoid

- vague descriptions like `helps with development`
- capability-only descriptions with no trigger context
- trigger-only descriptions that do not explain the capability

## Quick check

- Does the first sentence explain the capability?
- Does the second sentence explain when to use it?
- Would this description stand out from other skills in a list?
