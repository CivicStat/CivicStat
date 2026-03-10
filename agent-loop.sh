#!/usr/bin/env bash
# agent-loop.sh — CivicStat autonomous dev loop
# Reads TASKS.md, picks the next pending task, executes it via Claude Code, commits results.
set -euo pipefail

REPO_DIR="/Users/civiclabs/Developer/civic-labs/civicstat"
TASKS_FILE="$REPO_DIR/TASKS.md"
LOG_DIR="$REPO_DIR/.agent-logs"
LOCK_FILE="$LOG_DIR/agent-loop.lock"

cd "$REPO_DIR"
mkdir -p "$LOG_DIR"

# Prevent concurrent runs
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null)
  if kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "$(date -Iseconds) Agent loop already running (PID $LOCK_PID), exiting."
    exit 0
  fi
  rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/run-$TIMESTAMP.log"

log() { echo "$(date -Iseconds) $*" | tee -a "$LOG_FILE"; }

log "=== Agent loop starting ==="

# Find the first pending task (line starting with "- [ ]")
TASK_LINE=$(grep -n '^\- \[ \] ' "$TASKS_FILE" | head -1 || true)

if [ -z "$TASK_LINE" ]; then
  log "No pending tasks found in TASKS.md. Exiting."
  exit 0
fi

LINE_NUM=$(echo "$TASK_LINE" | cut -d: -f1)
TASK_ID=$(echo "$TASK_LINE" | sed 's/^[0-9]*:- \[ \] //' | awk '{print $1}')
TASK_DESC=$(echo "$TASK_LINE" | sed 's/^[0-9]*:- \[ \] //')

log "Picked task: $TASK_DESC"

# Mark task as in-progress in TASKS.md
sed -i '' "${LINE_NUM}s/- \[ \]/- [~]/" "$TASKS_FILE"

# Build the prompt for Claude Code
PROMPT="You are the CTO agent for CivicStat. Execute this task from TASKS.md:

$TASK_DESC

Instructions:
1. Read CLAUDE.md for project conventions
2. Read relevant source files before making changes
3. Implement the fix/feature with minimal, focused changes
4. Run typecheck (pnpm typecheck) to verify your changes compile
5. Do NOT commit — the agent-loop script handles commits

If the task is blocked (missing secrets, external dependency, unclear requirements), create a file .agent-logs/blocked-${TASK_ID}.md explaining the blocker and exit."

# Run Claude Code in non-interactive mode
log "Invoking Claude Code..."
claude --print --dangerously-skip-permissions "$PROMPT" >> "$LOG_FILE" 2>&1 || {
  log "Claude Code exited with error. Check $LOG_FILE for details."
  # Revert task status to pending on failure
  sed -i '' "${LINE_NUM}s/- \[~\]/- [ ]/" "$TASKS_FILE"
  exit 1
}

# Check if task was blocked
if [ -f "$LOG_DIR/blocked-${TASK_ID}.md" ]; then
  log "Task $TASK_ID is blocked. See .agent-logs/blocked-${TASK_ID}.md"
  sed -i '' "${LINE_NUM}s/- \[~\]/- [!]/" "$TASKS_FILE"
  git add "$TASKS_FILE" "$LOG_DIR/blocked-${TASK_ID}.md"
  git commit -m "chore: mark $TASK_ID as blocked

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
  exit 0
fi

# Check for actual changes
if git diff --quiet && git diff --cached --quiet; then
  log "No file changes detected. Marking task done anyway (may have been a no-op)."
  sed -i '' "${LINE_NUM}s/- \[~\]/- [x]/" "$TASKS_FILE"
  git add "$TASKS_FILE"
  git commit -m "chore: mark $TASK_ID done (no-op)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
  exit 0
fi

# Commit changes
log "Committing changes..."
sed -i '' "${LINE_NUM}s/- \[~\]/- [x]/" "$TASKS_FILE"
git add -A
git commit -m "feat($TASK_ID): $TASK_DESC

Automated by agent-loop.sh

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

log "=== Task $TASK_ID completed ==="
