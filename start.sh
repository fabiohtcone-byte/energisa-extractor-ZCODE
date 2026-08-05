#!/bin/bash
cd /home/z/my-project

# Kill any existing server
if [ -f server.pid ]; then
  kill $(cat server.pid) 2>/dev/null
  rm -f server.pid
  sleep 1
fi

# Start server as daemon
nohup node --max-old-space-size=512 server.cjs >> server.log 2>&1 &
echo $! > server.pid
echo "Server PID: $(cat server.pid)"
sleep 2

# Verify
if kill -0 $(cat server.pid) 2>/dev/null; then
  echo "Server is RUNNING on port 3000"
else
  echo "Server FAILED to start"
  exit 1
fi
