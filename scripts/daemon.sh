#!/usr/bin/env bash
# Manage the claw-chat DM daemon via tmux.
# Usage: ./daemon.sh {start|stop|restart|status|logs} [poll-interval-seconds]
#
# Requires: tmux, node

set -euo pipefail

SESSION="claw-dm"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DAEMON="$SCRIPT_DIR/dm-daemon.js"
POLL_INTERVAL="${2:-5}"

if [ ! -f "$DAEMON" ]; then
  echo "Error: dm-daemon.js not found at $DAEMON" >&2
  exit 1
fi

if ! command -v tmux &>/dev/null; then
  echo "Error: tmux is not installed." >&2
  echo "  macOS:  brew install tmux" >&2
  echo "  Ubuntu: sudo apt install tmux" >&2
  echo "  Arch:   sudo pacman -S tmux" >&2
  exit 1
fi

is_running() {
  tmux has-session -t "$SESSION" 2>/dev/null
}

case "${1:-}" in
  start)
    if is_running; then
      echo "Daemon is already running (tmux session: $SESSION)"
      echo "Use './daemon.sh logs' to view output, or './daemon.sh restart' to restart."
      exit 0
    fi
    tmux new-session -d -s "$SESSION" "node '$DAEMON' $POLL_INTERVAL"
    echo "Daemon started (tmux session: $SESSION, poll: ${POLL_INTERVAL}s)"
    echo "  Logs:    ./daemon.sh logs"
    echo "  Stop:    ./daemon.sh stop"
    echo "  Status:  ./daemon.sh status"
    ;;
  stop)
    if ! is_running; then
      echo "Daemon is not running."
      exit 0
    fi
    tmux kill-session -t "$SESSION"
    echo "Daemon stopped."
    ;;
  restart)
    if is_running; then
      tmux kill-session -t "$SESSION"
      echo "Stopped old session."
    fi
    tmux new-session -d -s "$SESSION" "node '$DAEMON' $POLL_INTERVAL"
    echo "Daemon restarted (tmux session: $SESSION, poll: ${POLL_INTERVAL}s)"
    ;;
  status)
    if is_running; then
      echo "Daemon is running (tmux session: $SESSION)"
      tmux list-panes -t "$SESSION" -F '  PID: #{pane_pid}  Started: #{pane_start_command}' 2>/dev/null || true
    else
      echo "Daemon is not running."
    fi
    ;;
  logs)
    if ! is_running; then
      echo "Daemon is not running. Showing log file instead:"
      echo ""
      if [ -f "$SCRIPT_DIR/dm-daemon.log" ]; then
        tail -40 "$SCRIPT_DIR/dm-daemon.log"
      else
        echo "No log file found."
      fi
      exit 0
    fi
    echo "Attaching to tmux session '$SESSION' (press Ctrl+B then D to detach)"
    echo ""
    tmux attach -t "$SESSION"
    ;;
  *)
    echo "Usage: ./daemon.sh {start|stop|restart|status|logs} [poll-interval-seconds]"
    echo ""
    echo "Commands:"
    echo "  start   — start the DM daemon in a background tmux session"
    echo "  stop    — stop the daemon"
    echo "  restart — stop and restart the daemon"
    echo "  status  — check if the daemon is running"
    echo "  logs    — attach to the tmux session (live), or show log file if stopped"
    exit 1
    ;;
esac
