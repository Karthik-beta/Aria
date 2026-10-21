#!/usr/bin/env bash
# Keeps the agent-ready and blocked labels in step with each issue's footer.
#
# An issue's footer ends with a "Blocked by: #12, #34" line, or "Blocked by: nothing".
# The issue is agent-ready when that line says nothing or every issue it names is
# closed. Otherwise it is blocked. Issues without a Blocked by line, and issues
# carrying neither label, are never touched.
#
# Run by .github/workflows/dependency-labels.yml with these environment variables:
#   GH_TOKEN, REPO (owner/name), EVENT_NAME, EVENT_ACTION, ISSUE_NUMBER (issues events).
# Sourcing the file defines the functions without running them, so tests can call them.

set -euo pipefail

declare -A BLOCKER_STATE=()

# Prints the last "Blocked by:" line of the issue body on stdin, without CR characters.
footer_line() {
  tr -d '\r' | grep -E '^Blocked by:' | tail -n 1 || true
}

# Prints the issue numbers named in the line given as $1, one per line.
footer_refs() {
  grep -oE '#[0-9]+' <<< "$1" | tr -d '#' || true
}

# Caches the state (OPEN or CLOSED) of issue $1 for this run. An unreadable issue counts as open.
load_blocker_state() {
  local number=$1 state
  if [ -n "${BLOCKER_STATE[$number]:-}" ]; then
    return 0
  fi
  state=$(gh issue view "$number" --repo "$REPO" --json state --jq .state || true)
  if [ -z "$state" ]; then
    echo "::warning::Could not read #$number, so it counts as open." >&2
    state=OPEN
  fi
  BLOCKER_STATE[$number]=$state
}

# Sets DECISION to ready, blocked or skip for the issue body on stdin.
# A global rather than a return value, so the state cache survives between issues.
readiness() {
  local line refs ref
  line=$(footer_line)
  if [ -z "$line" ]; then
    DECISION=skip
    return 0
  fi
  if [[ "$line" =~ ^Blocked\ by:[[:space:]]*nothing[[:space:]]*$ ]]; then
    DECISION=ready
    return 0
  fi
  refs=$(footer_refs "$line")
  if [ -z "$refs" ]; then
    echo "::warning::Blocked by line names no issues, so its labels were left alone: $line" >&2
    DECISION=skip
    return 0
  fi
  DECISION=ready
  for ref in $refs; do
    load_blocker_state "$ref"
    if [ "${BLOCKER_STATE[$ref]}" != "CLOSED" ]; then
      DECISION=blocked
      break
    fi
  done
}

# Applies the readiness rule to one issue, given as a JSON object with number, body, labels and state.
process_issue() {
  local json=$1 number state labels body add remove note
  number=$(jq -r '.number' <<< "$json")
  state=$(jq -r '.state' <<< "$json")
  if [ "$state" != "OPEN" ]; then
    return 0
  fi
  labels=$(jq -r '.labels[].name' <<< "$json")
  if ! grep -qxE 'agent-ready|blocked' <<< "$labels"; then
    return 0
  fi
  body=$(jq -r '.body // ""' <<< "$json")
  readiness <<< "$body"
  case "$DECISION" in
    ready) add=agent-ready remove=blocked ;;
    blocked) add=blocked remove=agent-ready ;;
    *) return 0 ;;
  esac

  local args=()
  note=""
  if ! grep -qx "$add" <<< "$labels"; then
    args+=(--add-label "$add")
    note="$add added"
  fi
  if grep -qx "$remove" <<< "$labels"; then
    args+=(--remove-label "$remove")
    note="${note:+$note, }$remove removed"
  fi
  if [ ${#args[@]} -eq 0 ]; then
    return 0
  fi
  gh issue edit "$number" --repo "$REPO" "${args[@]}" > /dev/null
  echo "::notice::#$number is $DECISION: $note"
}

# closed or reopened issue: revisit open issues whose footer names it.
on_blocker_change() {
  local rows row body refs
  # Search over-matches, so the footer parse below decides which issues are dependants.
  rows=$(gh issue list --repo "$REPO" --state open --search "\"#$ISSUE_NUMBER\" in:body" \
    --json number,body,labels,state --limit 200 --jq '.[] | tojson')
  while IFS= read -r row; do
    [ -n "$row" ] || continue
    body=$(jq -r '.body // ""' <<< "$row")
    refs=$(footer_refs "$(footer_line <<< "$body")")
    if grep -qx "$ISSUE_NUMBER" <<< "$refs"; then
      process_issue "$row"
    fi
  done <<< "$rows"
}

# edited issue: recompute the issue itself, in case its Blocked by line changed.
on_edit() {
  local row
  row=$(gh issue view "$ISSUE_NUMBER" --repo "$REPO" --json number,body,labels,state --jq '. | tojson')
  process_issue "$row"
}

# workflow_dispatch: recompute every open issue that carries either label.
recompute_all() {
  local ready_rows blocked_rows all row
  ready_rows=$(gh issue list --repo "$REPO" --state open --label agent-ready --limit 1000 \
    --json number,body,labels,state --jq '.[] | tojson')
  blocked_rows=$(gh issue list --repo "$REPO" --state open --label blocked --limit 1000 \
    --json number,body,labels,state --jq '.[] | tojson')
  # An issue carrying both labels appears in both lists.
  all=$(printf '%s\n%s\n' "$ready_rows" "$blocked_rows" | jq -c -s 'unique_by(.number)[]')
  while IFS= read -r row; do
    [ -n "$row" ] || continue
    process_issue "$row"
  done <<< "$all"
}

main() {
  case "$EVENT_NAME" in
    issues)
      case "$EVENT_ACTION" in
        closed | reopened) on_blocker_change ;;
        edited) on_edit ;;
        *) echo "Nothing to do for issues/$EVENT_ACTION." ;;
      esac
      ;;
    workflow_dispatch) recompute_all ;;
    *)
      echo "::error::Unexpected event $EVENT_NAME" >&2
      exit 1
      ;;
  esac
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
