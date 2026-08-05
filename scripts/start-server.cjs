const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..');
const logFile = path.join(dir, 'server.log');

function start() {
  const ts = new Date().toISOString();
  try { fs.appendFileSync(logFile, `\n--- ${ts} ---\n`); } catch {}

  const child = spawn('node', ['--max-old-space-size=512', 'server.cjs'], {
    cwd: dir,
    stdio: ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')],
    detached: true,
  });

  child.unref();
  fs.writeFileSync(path.join(dir, 'server.pid'), String(child.pid));
  console.log(`[${ts}] Started pid ${child.pid}`);
}

// Check if port 3000 is in use, kill existing
try {
  const { execSync } = require('child_process');
  try { execSync('fuser -k 3000/tcp 2>/dev/null', { timeout: 3000 }); } catch {}
} catch {}

setTimeout(start, 1000);
