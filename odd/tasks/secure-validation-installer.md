# Secure Validation and Installer Integrity

## Objective
Make `vsdd validate` fail closed when a target contains no VSDD artifacts, and replace mutable-`main` install/update downloads with versioned release assets authenticated by GitHub artifact attestations.

## Problem and motivation
An empty or incorrectly selected directory currently exits successfully, which can hide CI path mistakes. The README, platform installers, and updater fetch executable content from the moving `main` branch without authenticating the release that produced it.

## Authorized scope and constraints
- Implement the user-approved validation and release-attestation plan on `codex/secure-validation-installer`.
- Use the existing GitHub Actions + Node/npm stack; the user confirmed the repository is public, so GitHub artifact attestations are eligible without Enterprise Cloud.
- Verify downloaded assets against repository `ValentinZurita/vsdd` and the exact release workflow identity before extraction, execution, or installation side effects; missing `gh` or any verification failure must fail closed.
- Preserve exit codes 0 (valid), 1 (invalid/no artifacts), and 2 (missing target); update tests for the CLI contract.
- Use strict TDD with `npm test`; no strict-TDD setting existed, so this was selected as the safest default for security-sensitive behavior.
- Do not push, create a PR, or publish a release. RDD was off at start; do not start a review lifecycle.

## Acceptance criteria
- Empty and artifact-free targets report JSON `valid: false`, `results: []`, a clear human-readable message, and exit 1; valid targets remain 0 and missing paths remain 2.
- Release assets are versioned and attested by GitHub Actions; README bootstrap, Bash and PowerShell installers, and `vsdd update` use explicit release assets and verify repository/workflow identity before consuming them.
- Unavailable `gh`, missing/invalid attestations, altered assets, or unexpected signer identity cause no extraction, execution, installation, or update side effect.
- Focused checks and `npm test` pass; commit each work unit with its tests/docs in a Conventional Commit.

## TDD and verification
- Mode: strict TDD; source: user delegated the choice and strict TDD is the conservative default for installer trust behavior.
- Runner: `npm test` (`node --test`). Focused suites: `node --test tests/vsdd-validate.test.js tests/cli.test.js tests/vsdd-status.test.js tests/installer-integration.test.js`.
- Before each behavior change, add a test and record the failing RED result; then implement to GREEN and refactor without regressing the suite.
- Run shell syntax validation (`bash -n install.sh`) and PowerShell parsing on an available Windows-capable host; report unavailable platform checks honestly.
- Estimated authored diff: approximately 400 lines, excluding generated output; delivery strategy: `ask-on-risk`, monitor committed authored lines before each work-unit commit.

## Tasks and progress
- [x] **TASK-01 — Fail validation when no artifacts exist.** Route: delegated; trigger: behavior and CLI tests span multiple non-trivial files. Added empty/artifact-free directory cases before implementation; JSON now returns `valid: false`, `results: []`, and a clear message with exit 1. Evidence: RED — `node --test tests/vsdd-validate.test.js tests/cli.test.js` exited 1 (65 passed, 2 new failures); GREEN — same command exited 0 (67 passed); missing-path smoke check exited 2. Full `npm test` deferred until TASK-02 isolates the existing updater test's remote `git pull`. Commit: pending.
- [ ] **TASK-02 — Publish and consume attested releases.** Route: delegated; trigger: integration spans release workflow, README, Bash/PowerShell installers, updater, and tests. Add fail-closed tests first, create versioned release assets and attestations, verify before extraction/execution, run focused and full checks, commit. Evidence: pending.

## Current state and next step
- Progress: TASK-01 implemented and focused checks pass; full suite deferred as instructed because the current updater test can perform an unauthorized remote pull.
- Next: record TASK-01 commit identity after commit, then implement TASK-02; update this document and its Engram mirror after each task with verification and commit evidence.
