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

USER ubuntu
