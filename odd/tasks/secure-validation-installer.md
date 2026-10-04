# Secure Validation and Installer Integrity

## Objective
Make `vsdd validate` fail closed when a target contains no VSDD artifacts, and replace mutable-`main` install/update downloads with versioned release assets authenticated by GitHub artifact attestations.

## Problem and motivation
An empty or incorrectly selected directory currently exits successfully, which can hide CI path mistakes. The README, platform installers, and updater fetch executable content from the moving `main` branch without authenticating the release that produced it.

## Authorized scope and constraints
- Implement the user-approved validation and release-attestation plan on `codex/secure-validation-installer`.
- Use the existing GitHub Actions + Node/npm stack; the user confirmed the repository is public, so GitHub artifact attestations are eligible without Enterprise Cloud.
- Verify downloaded assets against repository `ValentinZurita/vsdd` and the exact release workflow identity before extraction, execution, or installation side effects; missing `gh` or any verification failure must fail closed.
- Enforce exact identity with `gh attestation verify --repo ValentinZurita/vsdd --cert-identity https://github.com/ValentinZurita/vsdd/.github/workflows/release.yml@refs/tags/<tag> --source-ref refs/tags/<tag>`; do not rely on the prefix-matching `--signer-workflow` option alone.
- Preserve exit codes 0 (valid), 1 (invalid/no artifacts), and 2 (missing target); update tests for the CLI contract.
- Use strict TDD with `npm test`; no strict-TDD setting existed, so this was selected as the safest default for security-sensitive behavior.
- Do not push, create a PR, or publish a release unless explicitly authorized. RDD was off at start; do not start a review lifecycle.

## Acceptance criteria
- Empty and artifact-free targets report JSON `valid: false`, `results: []`, a clear human-readable message, and exit 1; valid targets remain 0 and missing paths remain 2.
- Release assets are versioned and attested by GitHub Actions; README bootstrap, Bash and PowerShell installers, and `vsdd update` use explicit release assets and verify repository/workflow identity before consuming them.
- Unavailable `gh`, missing/invalid attestations, altered assets, or unexpected signer identity cause no extraction, execution, installation, or update side effect.
- Focused checks pass; report any full-suite baseline failures separately. Commit each work unit with its tests/docs in a Conventional Commit.

## TDD and verification
- Mode: strict TDD; source: user delegated the choice and strict TDD is the conservative default for installer trust behavior.
- Runner: `npm test` (`node --test`). Focused suites: `node --test tests/vsdd-validate.test.js tests/cli.test.js tests/vsdd-status.test.js tests/installer-integration.test.js`.
- Before each behavior change, add a test and record the failing RED result; then implement to GREEN and refactor without regressing the suite.
- Run shell syntax validation (`bash -n install.sh`) and PowerShell parsing on an available Windows-capable host; report unavailable platform checks honestly.
- Current authored change: implementation commit `f1c7671` (`fix(release): secure versioned attested installs`), based on cached `origin/main`; user explicitly requests a direct push to `main`; no PR chain is planned.

## Tasks and progress
- [x] **TASK-01 — Fail validation when no artifacts exist.** Route: delegated; trigger: behavior and CLI tests span multiple non-trivial files. Added empty/artifact-free directory cases before implementation; JSON now returns `valid: false`, `results: []`, and a clear message with exit 1. Evidence: RED — `node --test tests/vsdd-validate.test.js tests/cli.test.js` exited 1 (65 passed, 2 new failures); GREEN — same command exited 0 (67 passed); missing-path smoke check exited 2. Full `npm test` deferred until TASK-02 isolates the existing updater test's remote `git pull`. Commit: `eec2846` (`fix(validate): fail when no artifacts are found`).
- [x] **TASK-02 — Publish and consume attested releases.** Route: delegated; trigger: integration spans release workflow, README, Bash/PowerShell installers, updater, and tests. Implementation and focused checks are complete after TASK-03 closed the audit gaps. Evidence: initial RED — `node --test tests/vsdd-status.test.js tests/installer-integration.test.js` exited 1 (53 passed, 9 failed, 1 skipped); first-pass GREEN — same command passed (62 passed, 0 failed, 1 skipped); final focused GREEN — same command passed (63 passed, 0 failed, 1 skipped); `bash -n install.sh` and `git diff --check` passed. Post-rebase full suite: `npm test` exited 1 (199 passed, 4 failed, 1 skipped); failures are the three existing constitution expectations and `SKILL.md` size cap (4763 > 4500 bytes), all four corresponding input/test files unchanged from cached `origin/main`. PowerShell parse unavailable (neither `pwsh` nor `powershell` installed); no release was published or remotely queried. Commit: `f1c7671` (`fix(release): secure versioned attested installs`).
- [x] **TASK-03 — Close audited release-layout and installer trust gaps.** Route: delegated; trigger: coordinated changes across release workflow, platform install flows, README, updater, and integration tests. Added a `git archive --prefix` to the tarball workflow; regression test builds a tagged local Git fixture with the same archive/gzip logic, extracts it, and checks the `vsdd-${tag}` root expected by the README and updater. README's attested bootstrap now verifies, extracts, then invokes `scripts/install-skill.js`; `install.sh` and `install.ps1` are explicitly local-Git-checkout installers and no longer claim to authenticate release archives. Evidence: RED — `node --test tests/installer-integration.test.js` exited 1 (3 failed, 3 passed, 1 skipped); GREEN — `node --test tests/installer-integration.test.js tests/vsdd-status.test.js` passed (63 passed, 0 failed, 1 skipped); `bash -n install.sh && git diff --check` passed; post-rebase `npm test` exited 1 only on the four baseline failures recorded under TASK-02. Commit: `f1c7671` (`fix(release): secure versioned attested installs`).

## Current state and next step
- Progress: TASK-01 is already in main. TASK-02 and TASK-03 are committed as `f1c7671`, rebased onto the cached `origin/main`. User authorized a direct push to `main`; remote credential authorization is confirmed for the existing GitHub CLI session.
- Next: push the committed implementation and tracker evidence fast-forward to `origin main` without force. If the remote rejects the push, stop without fetching or force-pushing.
