#!/usr/bin/env bash

# jira_smart_sync.sh - Hardened, Zero-Trust Sync for ACLI
# Usage: cat body.txt | ./jira_smart_sync.sh <ISSUE_ID>
#
# Maintains one Pi-owned living status comment per Jira work item.
# It finds an existing marker comment anywhere in the fetched window and updates it.
# It creates a new comment only when no Pi marker comment exists.

set -euo pipefail

ISSUE_ID=${1:-}
PI_SYNC_MARKER="<!-- pi-sync-marker -->"
PI_SIGNATURE="🤖 *Synced by pi (AI assistant) on behalf of the developer.*"
COMMENT_LIMIT=${PI_SYNC_COMMENT_LIMIT:-50}
TMP_BODY=$(mktemp)
TMP_JSON=$(mktemp)

cleanup() {
  rm -f "$TMP_BODY" "$TMP_JSON"
}
trap cleanup EXIT

cat > "$TMP_BODY"

if [[ -z "$ISSUE_ID" ]]; then
  echo "Usage: cat body.txt | $0 <ISSUE_ID>"
  exit 1
fi

# Fetch newest comments first. The marker search is not latest-comment-only;
# the limit only bounds API cost/noise. Increase PI_SYNC_COMMENT_LIMIT if needed.
acli jira workitem comment list --key "$ISSUE_ID" --json --limit "$COMMENT_LIMIT" --order "-created" > "$TMP_JSON"

export PI_SYNC_MARKER
export PI_SIGNATURE
export NEW_BODY_FILE="$TMP_BODY"
export COMMENTS_JSON_FILE="$TMP_JSON"

MATCH_DATA=$(python3 <<'PY'
import json
import os
import re
import sys
from pathlib import Path

marker = os.environ.get("PI_SYNC_MARKER", "<!-- pi-sync-marker -->")
signature = os.environ.get("PI_SIGNATURE", "")
new_body_file = Path(os.environ["NEW_BODY_FILE"])
comments_json_file = Path(os.environ["COMMENTS_JSON_FILE"])


def get_text(obj):
    if obj is None:
        return ""
    if isinstance(obj, str):
        return obj
    if isinstance(obj, list):
        return "\n".join(get_text(x) for x in obj)
    if isinstance(obj, dict):
        # Common flattened outputs first.
        rendered = obj.get("renderedBody")
        if isinstance(rendered, str):
            return rendered
        body = obj.get("body")
        if isinstance(body, str):
            return body
        # Atlassian Document Format text nodes.
        if obj.get("type") == "text":
            return obj.get("text", "")
        content = obj.get("content")
        if content:
            return get_text(content)
        return "\n".join(get_text(v) for v in obj.values() if isinstance(v, (dict, list, str)))
    return str(obj)


def normalize(text):
    # Jira/ACLI rendering can alter blank lines and trailing whitespace. Keep the
    # comparison conservative: avoid duplicates when content is materially equal.
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in text.strip().split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def comment_id(comment):
    for key in ("id", "commentId", "comment_id"):
        value = comment.get(key) if isinstance(comment, dict) else None
        if value is not None:
            return str(value)
    return ""


def unwrap_comments(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("comments", "values", "results", "data"):
            value = data.get(key)
            if isinstance(value, list):
                return value
        if "id" in data:
            return [data]
    return []

try:
    new_text = new_body_file.read_text().strip()
    data = json.loads(comments_json_file.read_text())
    comments = unwrap_comments(data)

    if not comments:
        print("CREATE|no existing comments")
        raise SystemExit(0)

    # Comments are fetched newest first. Pick the newest Pi-owned marker comment,
    # not necessarily the absolute latest comment. Human comments remain untouched.
    for comment in comments:
        text = get_text(comment.get("body", comment)) if isinstance(comment, dict) else get_text(comment)
        owns_comment = marker in text or (signature and signature in text)
        if not owns_comment:
            continue

        cid = comment_id(comment)
        if not cid:
            print("CREATE|marker found without id")
            raise SystemExit(0)

        if normalize(new_text) == normalize(text):
            print(f"NOOP|{cid}")
        else:
            print(f"UPDATE|{cid}")
        raise SystemExit(0)

    print("CREATE|no pi marker comment")
except Exception as exc:
    # Fail-open to create: better to keep stakeholder visibility than silently drop sync.
    print(f"CREATE|parse fallback: {exc}")
PY
)

ACTION_CODE=$(echo "$MATCH_DATA" | cut -d'|' -f1)
TARGET_ID=$(echo "$MATCH_DATA" | cut -d'|' -f2-)

case "$ACTION_CODE" in
    NOOP)
        echo "SYNC: Existing Pi status is already current (ID: $TARGET_ID)."
        ;;
    UPDATE)
        echo "SYNC: Updating existing Pi status (ID: $TARGET_ID)."
        acli jira workitem comment update --key "$ISSUE_ID" --id "$TARGET_ID" --body-file "$TMP_BODY"
        ;;
    *)
        echo "SYNC: Creating Pi status comment ($TARGET_ID)."
        acli jira workitem comment create --key "$ISSUE_ID" --body-file "$TMP_BODY"
        ;;
esac
