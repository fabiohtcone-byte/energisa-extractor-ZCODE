#!/bin/bash
cd /home/z/my-project
while true; do
    python3 server.py >> /tmp/server.log 2>&1
    echo "[$(date)] Server died, restarting in 1s..." >> /tmp/server.log
    sleep 1
done
