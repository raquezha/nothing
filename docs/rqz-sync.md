# rqz-sync

`rqz-sync` is the planned RQZ multi-machine Git sync helper.

It is intentionally boring:

- shell, not Python
- installed by `./bootstrap.sh`
- manual command, not a daemon
- Git owns repo state
- Pi/agent will only write commit messages in a later phase

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

Reports repo state under `RQZ_SYNC_ROOTS`. This is the default.

```bash
rqz-sync --safe
```

Only pulls/pushes clean repos. Dirty repos are reported and left untouched.

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

## Later phase

Full dirty-repo sync should stage changes, ask Pi for a meaningful commit message from the staged diff, commit, rebase, and push.

If Pi cannot produce a message, skip the repo. Do not use junk messages like `sync changes`.

Refs #61
