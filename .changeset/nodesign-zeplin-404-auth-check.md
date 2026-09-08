---
"@raquezha/nodesign": patch
---

Disambiguate Zeplin 404 screen responses by validating token identity against /v1/users/me, returning AUTH_REJECTED (TOKEN_INVALID) when credentials are invalid.
