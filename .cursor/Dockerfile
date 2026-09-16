# Cloud Agent base image for the nothing monorepo.
# Ubuntu 24.04 mirrors the local dev target; Node 24 matches CI (.github/workflows/ci-validate.yml)
# and satisfies the >=22.19 engine requirement of the Pi runtime dependencies.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# System toolchain required by the repo verification suite and CI jobs:
# - git, curl, ca-certificates: checkout, downloads, and script guardrail tests
# - python3, build-essential: Graphify self-check + node-gyp for any native builds
# - zsh: exercises the zsh branch of the shell-integration verification
# - shellcheck: the CI "Shellcheck" job (severity=warning) over all shell scripts
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        python3 \
        build-essential \
        zsh \
        shellcheck \
    && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Ensure a non-root `ubuntu` user (uid/gid 1000) exists to match environment.json's `user`.
# The ubuntu:24.04 base image already ships an `ubuntu` user/group at 1000, so the
# creation is guarded to stay idempotent (a plain `groupadd`/`useradd` fails with
# "group 'ubuntu' already exists"). The guard also future-proofs against a base image
# that drops the default user.
RUN if ! getent group ubuntu >/dev/null 2>&1; then groupadd --gid 1000 ubuntu; fi \
    && if ! id -u ubuntu >/dev/null 2>&1; then \
        useradd --uid 1000 --gid 1000 --shell /bin/bash --create-home ubuntu; \
    fi

USER ubuntu
