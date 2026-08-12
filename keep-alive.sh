#!/bin/bash
cd /home/z/my-project/.next/standalone
while true; do
  echo "[$(date)] Starting standalone server..." >> /tmp/server.log
  NODE_ENV=production node --max-old-space-size=512 server.js >> /tmp/server.log 2>&1
  EXIT=$?
  echo "[$(date)] Exited with code $EXIT, restarting in 2s..." >> /tmp/server.log
  sleep 2
done
