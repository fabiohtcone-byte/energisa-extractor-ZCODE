#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting server..."
  node --max-old-space-size=512 server.cjs 2>&1
  EXIT=$?
  echo "[$(date)] Server exited with code $EXIT, restarting in 2s..."
  sleep 2
done
