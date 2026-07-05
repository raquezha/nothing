# Documentation destination map

Use this map to keep durable documentation minimal and accurate.

| Knowledge type | Destination | Rule |
| --- | --- | --- |
| Permanent agent behavior or safety rule | `AGENTS.md` | Keep short, imperative, and repo-wide. |
| Pi-specific agent/skill behavior | `pi/AGENTS.md` | Use for pi-local conventions and skill/harness behavior. |
| User-facing repo workflow | `README.md` | Explain how to use the repo, not internal debate. |
| Skill inventory or skill usage | `pi/skills/README.md` | List notable skills and categories. |
| Specific skill behavior | `pi/skills/**/SKILL.md` | Keep activation-time instructions only. |
| Long skill examples or decision maps | `pi/skills/**/references/*.md` | Move bulky details out of `SKILL.md`. |
| Domain or technical memory | `docs/agents/*.md` | Store condensed durable rules, not session logs. |
| Temporary task state | `.workflow/tasks/*/WORK.md` | Never copy wholesale into durable docs. |

## Anti-bloat checks

Before editing durable docs, ask:

1. Is this a durable rule or just a session event?
2. Will a future agent need this on most related tasks?
3. Is this already documented elsewhere?
4. Can this be one clear rule instead of a paragraph?
5. Does this belong in a skill reference instead of `AGENTS.md`?

## Never document

- Secrets, credentials, tokens, private URLs, or env values.
- Raw conversation transcripts.
- Temporary task progress that belongs in `.workflow/tasks/*/WORK.md`.
- The user's emotional venting, except as a neutral process rule when it affects future agent behavior.
