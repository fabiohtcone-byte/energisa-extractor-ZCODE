#!/bin/bash
# Kill any existing server
fuser -k 3000/tcp 2>/dev/null
sleep 1

# Start server with proper detach
cd /home/z/my-project
nohup node --max-old-space-size=512 app.cjs >> /home/z/my-project/server.log 2>&1 &
PID=$!
echo $PID > /home/z/my-project/server.pid

# Wait for it to be ready
for i in $(seq 1 10); do
  sleep 1
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Server started (PID: $PID)"
    exit 0
  fi
done
echo "❌ Server failed to start"
exit 1
