#!/bin/bash

# jira_smart_sync.sh - Hardened, Zero-Trust Sync for ACLI
# Usage: cat body.txt | ./jira_smart_sync.sh <ISSUE_ID>

ISSUE_ID=$1
SIGNATURE="🤖 *Synced by pi (AI assistant) on behalf of the developer."
TMP_BODY=$(mktemp)
TMP_JSON=$(mktemp)

# Read body from stdin
cat > "$TMP_BODY"

if [[ -z "$ISSUE_ID" ]]; then
  echo "Usage: cat body.txt | $0 <ISSUE_ID>"
  rm "$TMP_BODY" "$TMP_JSON"
  exit 1
fi

# 1. Fetch last 5 comments, newest first
# We use --key explicitly to ensure the project context is derived from the issue ID
acli jira workitem comment list --key "$ISSUE_ID" --json --limit 5 --order "-created" > "$TMP_JSON"

# 2. Smart Selection Logic
# We pass both the current body and signature to Python for a robust check.
export PI_SIGNATURE="$SIGNATURE"
export NEW_BODY_FILE="$TMP_BODY"

MATCH_DATA=$(python3 -c "
import sys, json, os, re

def get_text(obj):
    if obj is None: return ""
    if isinstance(obj, str): return obj
    if isinstance(obj, list): return ' '.join(get_text(x) for x in obj)
    if isinstance(obj, dict):
        # 1. Check common plain-text keys in acli flattened output
        if 'renderedBody' in obj: return obj['renderedBody']
        if 'body' in obj and isinstance(obj['body'], str): return obj['body']
        # 2. Check ADF (Atlassian Document Format) structure
        if obj.get('type') == 'text': return obj.get('text', '')
        content = obj.get('content')
        if content: return get_text(content)
        # 3. Last resort: join all string values in the dict
        return ' '.join(get_text(v) for v in obj.values() if isinstance(v, (dict, list, str)))
    return str(obj)

try:
    sig = os.environ.get('PI_SIGNATURE', '')
    with open('$TMP_BODY', 'r') as f:
        new_text = f.read().strip()
    
    with open('$TMP_JSON', 'r') as f:
        data = json.load(f)
    
    # zero-trust handling for any possible acli json wrapper
    if isinstance(data, list):
        comments = data
    elif isinstance(data, dict):
        # check common wrappers: 'comments', 'values', or just the dict itself if it has the fields
        comments = data.get('comments', data.get('values', []))
        if not comments and 'id' in data: # singular response case
            comments = [data]
    else:
        comments = []

    if not comments:
        sys.exit(1)
    
    # 1. Is the LATEST comment already our exact same content?
    latest = comments[0]
    latest_text = get_text(latest.get('body', '')).strip()
    
    # 2. Match logic: Should we UPDATE or CREATE?
    def extract_slices(text):
        # Look for the Vertical Slices list to determine if the task phase is the same
        match = re.search(r'Vertical Slices:(.*?)(?:\n\n|Commit/MR|---)', text, re.S)
        return match.group(1).strip() if match else text

    if sig in latest_text:
        # If the Vertical Slices are identical, we are just updating progress 
        # on the same phase. Update the comment to avoid spam.
        if extract_slices(new_text) == extract_slices(latest_text):
            print(f'UPDATE|{latest["id"]}')
            sys.exit(0)
        
    # 3. If slices changed (new phase) or latest is NOT ours, CREATE a new one.
    print('CREATE|New thread')
    sys.exit(0)
    
except Exception as e:
    # Fallback to create if anything goes wrong with parsing
    sys.exit(1)
")

ACTION_CODE=$(echo "$MATCH_DATA" | cut -d'|' -f1)
TARGET_ID=$(echo "$MATCH_DATA" | cut -d'|' -f2)

case "$ACTION_CODE" in
    ABORT)
        echo "SYNC: No changes detected in progress. Skipping update to avoid spam."
        ;;
    UPDATE)
        echo "SYNC: Updating existing Pi status (ID: $TARGET_ID)."
        acli jira workitem comment update --key "$ISSUE_ID" --id "$TARGET_ID" --body-file "$TMP_BODY"
        ;;
    *)
        echo "SYNC: Creating new status point (Last comment was human or ticket is new)."
        acli jira workitem comment create --key "$ISSUE_ID" --body-file "$TMP_BODY"
        ;;
esac

rm "$TMP_BODY" "$TMP_JSON"
