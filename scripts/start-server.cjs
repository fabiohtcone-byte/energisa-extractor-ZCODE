const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const dir = path.resolve(__dirname, '..');
const log = path.join(dir, 'server.log');

function start() {
  const ts = new Date().toISOString();
  try { fs.appendFileSync(log, `\n--- ${ts} ---\n`); } catch {}

  const child = spawn('npx', ['next', 'dev', '-p', '3000'], {
    cwd: dir,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  child.stdin.on('error', () => {});
  const ls = fs.createWriteStream(log, { flags: 'a' });
  child.stdout.on('data', d => { process.stdout.write(d); ls.write(d); });
  child.stderr.on('data', d => { process.stderr.write(d); ls.write(d); });
  child.on('exit', (code, signal) => {
    ls.write(`Exited (${code}/${signal}). Restart 5s...\n`);
    setTimeout(start, 5000);
  });

  console.log(`[${ts}] Started pid ${child.pid}`);
}

start();
