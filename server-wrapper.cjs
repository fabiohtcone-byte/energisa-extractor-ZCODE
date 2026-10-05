// Server wrapper that keeps the server alive and restarts on crash
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const LOG_FILE = '/home/z/my-project/server-output.log';
let logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function writeLog(msg) {
  try { logStream.write(new Date().toISOString() + ' ' + msg + '\n'); } catch(e) {}
}

function startServer() {
  writeLog('Starting server...');
  const child = spawn('node', ['--max-old-space-size=512', '/home/z/my-project/app.cjs'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: '/home/z/my-project',
    env: { ...process.env, NODE_ENV: 'production' }
  });

  child.stdout.on('data', d => {
    try { logStream.write(d); } catch(e) {}
  });
  child.stderr.on('data', d => {
    try { logStream.write(d); } catch(e) {}
  });

  child.on('exit', (code, sig) => {
    writeLog('Server exited: code=' + code + ' signal=' + sig + ' - restarting in 2s');
    setTimeout(startServer, 2000);
  });

  child.on('error', e => {
    writeLog('Server error: ' + e.message + ' - restarting in 2s');
    setTimeout(startServer, 2000);
  });

  // Save PID
  fs.writeFileSync('/home/z/my-project/server.pid', String(child.pid));
  writeLog('Server PID: ' + child.pid);
  return child;
}

startServer();

// Keep alive
setInterval(() => {}, 60000);

// Handle signals
process.on('SIGTERM', () => { writeLog('Wrapper received SIGTERM, shutting down'); process.exit(0); });
process.on('SIGINT', () => { writeLog('Wrapper received SIGINT, shutting down'); process.exit(0); });
