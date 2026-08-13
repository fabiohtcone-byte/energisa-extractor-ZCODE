#!/bin/bash
LOG="/home/z/my-project/server.log"
cd /home/z/my-project
while true; do
  echo "[$(date '+%H:%M:%S')] Starting server..." >> "$LOG"
  node server.cjs >> "$LOG" 2>&1
  EXIT_CODE=$?
  echo "[$(date '+%H:%M:%S')] Crashed with exit $EXIT_CODE, restarting in 3s..." >> "$LOG"
  sleep 3
done