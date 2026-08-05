const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const dir = path.resolve(__dirname, '..');
const log = path.join(dir, 'server.log');

function start() {
  const ts = new Date().toISOString();
  try { fs.appendFileSync(log, `\n--- ${ts} ---\n`); } catch {}

  const child = spawn('node', ['server.cjs'], {
    cwd: dir,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  const ls = fs.createWriteStream(log, { flags: 'a' });
  child.stdout.on('data', d => { process.stdout.write(d); ls.write(d); });
  child.stderr.on('data', d => { process.stderr.write(d); ls.write(d); });
  child.on('exit', (code, signal) => {
    ls.write(`Exited (${code}/${signal}). Restart 3s...\n`);
    setTimeout(start, 3000);
  });

  console.log(`[${ts}] Started pid ${child.pid}`);
}

start();
