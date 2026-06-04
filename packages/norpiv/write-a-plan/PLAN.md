# Plan: restore newline before after_script in kmp template
*Linked Problem: /Users/raquezha/IdeaProjects/ci-component/PROBLEM.md*

## Objective
Fix the malformed YAML in templates/kmp/template.yml where the job-level key `after_script:` was concatenated onto the previous shell line (`fi  after_script:`), causing the `deploy:firebase:review:android` job to fail with a bash syntax error. Restore valid YAML so CI runs succeed.

## The Strategy (Decision Tree)
- **Approach Chosen:** Minimal, localized one-line edit in templates/kmp/template.yml to insert a newline so `after_script:` is parsed as a job-level key. Rationale: lowest-risk, fastest verification, directly addresses the observed failure.
- **Alternatives Considered:**
  1. Revert commit cf7530a that introduced the change — safer when multiple unrelated edits exist, but higher friction and may remove intended changes.
  2. Add a repo-wide automated guard (CI grep/yamllint across templates) to catch similar issues — good long-term prevention but out-of-scope for the immediate unblock.
  3. Scripted bulk-fix across templates — faster if many occurrences exist but risks unintended edits; repo search found only one match here.

## Phase 0: The Feedback Loop (TDD)
> Goal: Prove the problem exists and establish a baseline for success.
- Action: Confirm the malformed line and capture context. Reproduce the failure evidence.
  - Commands:
    - rg -n "fi  after_script:" templates/kmp/template.yml || true
    - sed -n '1196,1216p' templates/kmp/template.yml
    - (optional) Inspect pipeline logs for the error:
      - rg -n "syntax error near unexpected token .*after_script" -S path/to/job-logs || true
- Verification Command:
  - rg -n "fi  after_script:" templates/kmp/template.yml && sed -n '1196,1216p' templates/kmp/template.yml
- Expected Result:
  - The snippet shows `      fi  after_script:` and the repository contains the single problematic occurrence. Pipeline logs include `bash: eval: line 580: syntax error near unexpected token `after_script:'` as the baseline failure.

## Phase 1: Foundations
> Goal: Make the minimal edit and validate with yamllint / local checks.
- Step 1.1: Create a branch:
  - git checkout -b fix/template-kmp-after-script-newline
- Step 1.2: Edit the file (one-line change):
  - Replace:

```
      fi  after_script:
    - rm -rf build-output/
```

  - With:

```
      fi
    after_script:
      - rm -rf build-output/
```

  Ensure the indentation of `after_script:` matches other job-level keys (two-space relative to the job block).
- Step 1.3: Lint the file:
  - yamllint -c .yamllint.yml templates/kmp/template.yml
- Step 1.4: Commit the change:
  - git add templates/kmp/template.yml
  - git commit -m "fix(template): restore newline before after_script in kmp template"
- Verification Command:
  - yamllint -c .yamllint.yml templates/kmp/template.yml && git --no-pager show --name-only --oneline HEAD
- Expected Result:
  - yamllint reports no issues for the edited file and the commit exists with the expected message.

Notes:
- If local hooks are installed, they may run additional checks. This is a YAML-only change so ktlint/detekt/JAR sync should not be affected, but pre-push may run tests.

## Phase 2: Mechanics
> Goal: Push, open MR, run CI, and confirm the deploy job succeeds.
- Step 2.1: Push branch:
  - git push --set-upstream origin fix/template-kmp-after-script-newline
- Step 2.2: Open MR (title & description):
  - Title: fix(template): restore newline before after_script in kmp template
  - Description: Link to PROBLEM.md, explain the one-line fix, reference commit cf7530a, ask reviewers to approve.
- Step 2.3: Observe MR pipeline and the specific job logs for `deploy:firebase:review:android`.
- Step 2.4: Verify the formerly failing job completes successfully.
- Verification Command:
  - Use the GitLab UI to view the MR pipeline job logs or use the GitLab API/CLI to fetch logs and grep for:
    - "✅ Distributed to Firebase App Distribution"
- Expected Result:
  - The deploy job runs to completion without the `after_script:` syntax error and shows the success message.

## Phase 3: Integration & Surface
> Goal: Merge the fix and optionally add a preventive check.
- Step 3.1: Merge the MR after CI & review pass.
- Step 3.2: Optionally re-run a pipeline on main to ensure branch-level health.
- Step 3.3 (recommended): Add a lightweight guard to catch this category of error in future:
  - Example CI/pre-push check:
    - rg -n "[[:space:]]fi[[:space:]]+after_script:" templates || true
  - Or ensure yamllint runs against all templates early in CI.
- Verification Command:
  - After merge, re-trigger the deploy job on main and confirm the success message is present in job logs.

## Risks & Mitigations
- Risk: Wrong indentation when inserting the newline introduces a new YAML parsing error.
  - Mitigation: Run yamllint and visually inspect surrounding keys. Optionally validate the entire CI YAML with GitLab CI Lint.
- Risk: Local/CI pre-push hooks or CI checks fail due to unrelated checks.
  - Mitigation: Keep the change minimal; run local pre-commit hooks and required checks before pushing. If unrelated failures occur, fix them in separate commits.
- Risk: Similar concatenation exists elsewhere but was missed.
  - Mitigation: Run a repository-wide grep for the pattern and include any further hits in the MR or address them in a follow-up.

## Rollback Plan
- Revert the commit if it causes regressions:
  - git revert <commit-hash> && git push origin HEAD
- If already merged, use GitLab's revert MR button or push a revert commit and open a revert MR.
- If urgent pipeline unblock is required, create a hotfix branch and apply the last-known-good template state.

## Atomic commits checklist
- Commit 1: One-line fix to templates/kmp/template.yml (single, focused commit).
- Commit 2 (optional): Add guard/preventive check (separate commit).

Suggested MR title & message
- Title: fix(template): restore newline before after_script in kmp template
- Body: One-line description + link to PROBLEM.md + note that this is a minimal fix to restore YAML validity and unblock deploy:firebase:review:android.

Next actions (choose one)
- I can apply the one-line fix now, create branch + commit, push and open an MR for you.
- I can produce a patch/diff for you to review and apply locally.
- Or I can stop here — the PLAN.md is created and ready.

Recommendation
- After applying the fix, consider adding the optional guard to catch similar accidental concatenations earlier.
- For a hands-off implementation (branch, push, MR creation), consider switching to a premium model so I can perform the full apply/push/MR flow securely.
