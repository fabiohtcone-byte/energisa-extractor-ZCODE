#!/bin/bash
# Watchdog: auto-restart Next.js server on crash
LOG="/home/z/my-project/server.log"
cd /home/z/my-project

while true; do
  echo "[$(date '+%H:%M:%S')] Starting server..." >> "$LOG"
  npx next start -p 3000 >> "$LOG" 2>&1
  EXIT_CODE=$?
  echo "[$(date '+%H:%M:%S')] Crashed with exit $EXIT_CODE, restarting in 2s..." >> "$LOG"
  sleep 2
done
