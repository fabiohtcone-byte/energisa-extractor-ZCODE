const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const dir = path.resolve(__dirname, '..');
const log = path.join(dir, 'server.log');

function start() {
  try { fs.appendFileSync(log, `\n--- ${new Date().toISOString()} ---\n`); } catch {}
  const child = spawn('node', ['server.cjs'], {
    cwd: dir,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const ls = fs.createWriteStream(log, { flags: 'a' });
  child.stdout.on('data', d => { process.stdout.write(d); ls.write(d); });
  child.stderr.on('data', d => { process.stderr.write(d); ls.write(d); });
  child.on('exit', (code) => {
    ls.write(`Exited (${code}). Restarting 3s...\n`);
    setTimeout(start, 3000);
  });
}

start();