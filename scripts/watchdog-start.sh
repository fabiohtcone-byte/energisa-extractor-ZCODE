#!/bin/bash
# Watchdog script - keeps server alive
cd /home/z/my-project
while true; do
  echo "[watchdog] Starting server at $(date)"
  node --max-old-space-size=256 app.cjs 2>&1
  EXIT_CODE=$?
  echo "[watchdog] Server exited with code $EXIT_CODE at $(date)"
  if [ $EXIT_CODE -ne 0 ]; then
    echo "[watchdog] Restarting in 3 seconds..."
    sleep 3
  else
    echo "[watchdog] Clean exit, not restarting"
    break
  fi
done
