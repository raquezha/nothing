# rqz-sync

`rqz-sync` is the RQZ multi-machine Git sync helper.

It is intentionally boring:

- shell, not Python
- installed by `./bootstrap.sh`
- manual command, not a daemon
- Git owns repo state
- Pi/agent only writes a commit subject; shell owns Git

## Install

```bash
./bootstrap.sh
```

Bootstrap links:

```txt
bin/rqz-sync -> ~/.local/bin/rqz-sync
```

It also creates this config only if missing:

```txt
~/.config/nothing/rqz-sync
```

Bootstrap never runs sync.

## Current modes

```bash
rqz-sync --dry-run
```

Reports repo state under `RQZ_SYNC_ROOTS` without changing anything.

```bash
rqz-sync --safe
```

Only pulls/pushes clean repos. Dirty repos are reported and left untouched.

```bash
rqz-sync
```

Stages **all** dirty changes in each eligible repo, rejects obvious secret files/content, asks Pi for one commit subject from the staged diff, commits, rebases, then pushes. If Pi fails, the repo is left staged for review.

## Branch policy

No hardcoded `main` / `master` policy.

A branch is syncable only when the current branch has an upstream:

```bash
git rev-parse --abbrev-ref --symbolic-full-name @{u}
```

No upstream means skip with a hint.

## Stop conditions

Global sync stops per repo when Git says the repo needs human attention:

- merge in progress
- rebase in progress
- cherry-pick in progress
- unmerged files
- push/pull failure

No force push. No auto conflict resolution.

## Commit policy

Pi receives the staged status, stat, and diff, then returns one imperative subject no longer than 72 characters. It has no tools, extensions, skills, or context files for this call.

The script never invents a fallback like `sync changes`. If Pi cannot produce a valid subject, it stops that repo with changes staged.

The secret check is deliberately conservative: it stops for `.env`, private-key-like filenames, private-key content, or obvious `TOKEN`/`SECRET`/`API_KEY`/`PASSWORD` assignments. Review and unstage false positives manually.

Refs #61
