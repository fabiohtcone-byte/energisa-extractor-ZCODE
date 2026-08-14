#!/bin/bash
while true; do
  if ! curl -s -o /dev/null -w '' http://localhost:3000/ 2>/dev/null; then
    kill $(lsof -t -i:3000) 2>/dev/null
    cd /home/z/my-project && setsid node app.cjs > /dev/null 2>&1 &
  fi
  sleep 10
done
