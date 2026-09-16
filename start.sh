#!/bin/bash
cd /home/z/my-project
exec node --max-old-space-size=256 app.cjs
