# Antigravity OAuth/Login extension

Manual-only Google Antigravity support for Pi.

## Current status
This extension is **experimental on latest Pi**.

What currently works:
- OAuth login flow can be restored with `/login`
- Antigravity models can be registered and shown in model selection
- The extension defaults to a repo-local provider identity: `antigravity-cli`
- Requests now use a direct `streamSimple` transport instead of relying on Pi runtime dispatch through a local proxy
- `/antigravity.doctor` reports the active provider and transport wiring
- Minimal end-to-end text generation is now verified on latest Pi (for example `antigravity-cli/gemini-3-flash` replying `OK` in print mode)

What is still under verification:
- Individual Antigravity models beyond the verified minimal `gemini-3-flash` path still need wider manual validation
- Older Pi builds reportedly still work end-to-end with the same account, which points to a runtime/provider compatibility gap rather than an auth problem

## Version matrix
| Pi path | Status | Evidence |
| --- | --- | --- |
| Latest Pi (`0.72.1` observed during planning) | OAuth + model registration work; direct custom transport verified for minimal text generation | Local extension starts, defaults to `antigravity-cli`, routes through `streamSimple`, and `gemini-3-flash` can answer `OK` in print mode |
| Known-good older Pi | End-to-end responses reportedly worked with the old built-in provider path | Record the exact version during Phase 0 verification before choosing a long-term pin |

## Load the extension
```bash
pi --antigravity
# or
ANTIGRAVITY_DEBUG=1 pi -e ./pi/extensions/noantigravity
```

Then select an `antigravity-cli/...` model and use `/login antigravity-cli` if needed.

The login flow reads `ANTIGRAVITY_CLIENT_SECRET` from your shell, and also from `~/.pi-secrets/.env` if it exists.

Optional transport override for endpoint experiments:

```bash
ANTIGRAVITY_DEBUG=1 ANTIGRAVITY_BASE_URL=https://daily-cloudcode-pa.sandbox.googleapis.com pi -e ./pi/extensions/noantigravity
```

## Diagnostics
Use the doctor command after startup:

```text
/antigravity.doctor
```

With `ANTIGRAVITY_DEBUG=1`, sanitized runtime diagnostics are written to:

```text
~/.pi/agent/antigravity.log
```

The log is intentionally limited to routing metadata such as:
- provider id
- API type
- transport provider
- endpoint strategy
- inferred model id
- request type
- upstream HTTP status

The log must **not** be used to capture tokens, refresh credentials, authorization headers, or full prompt bodies.

## Reproduction loop
1. Start Pi with the extension and `ANTIGRAVITY_DEBUG=1`
2. Run `/antigravity.doctor`
3. Authenticate with `/login` if needed
4. Select an `antigravity-cli/...` model
5. Send one minimal prompt
6. Inspect `~/.pi/agent/antigravity.log` for `provider request` and `upstream status`
7. Optional non-interactive verification:
   ```bash
   ANTIGRAVITY_DEBUG=1 pi --no-session --no-context-files --no-extensions -e ./pi/extensions/noantigravity --model antigravity-cli/gemini-3-flash -p "reply with exactly: OK"
   ```
8. If needed, repeat once with `ANTIGRAVITY_BASE_URL=...` to compare endpoint behavior

## Exit criteria
Choose **latest-Pi extension path** only if all of the following are true:
- a selected Antigravity model returns a real response
- the same behavior survives a Pi restart and extension reload
- the docs in this repo match the observed behavior

Choose **pin a known-good older Pi** if any of the following remain true after the direct transport experiment:
- latest Pi still cannot produce stable responses through the custom `streamSimple` transport
- the Cloud Code Assist / Antigravity endpoint behavior has changed incompatibly
- the required behavior depends on core functionality that cannot be recreated through repo-local extensions
