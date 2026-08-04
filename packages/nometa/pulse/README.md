# pulse

> **The "Pre-Flight Check" for the agentic environment.**

`pulse` is a diagnostic skill used to verify the health and optimization status of your AI-assisted workflow. It answers the question: *"Is this agent fully powered up and saving me tokens, or is it flying blind?"*

## Features

- **Compression Check**: Confirms if **Headroom** is online and active for context compression.
- **Observability Status**: Checks if **Notrace** is capturing sessions and how many have been recorded in the current root.
- **Workflow Context**: Displays the active **RPIV** task or **Research** branch.

## Usage

Inside the Pi agent, simply type:

```text
/pulse
```

## Output Example

```text
[nothing] Environment Pulse
--------------------------------------------------
Headroom:      online
Notrace:       Active (9 sessions)
Active Task:   local-smoke
--------------------------------------------------
```

## Why it matters

`pulse` is the primary troubleshooting tool for performance issues. If the agent feels expensive or context features seem missing, `/pulse` quickly shows whether Headroom is offline, Notrace is inactive, or no workflow is active.
