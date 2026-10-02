#!/usr/bin/env node
// Cluster-based server wrapper that auto-restarts on crash
// Uses Node.js cluster module for reliable crash recovery
const cluster = require('cluster');
const path = require('path');

if (cluster.isPrimary) {
  const APP_PATH = path.join(__dirname, 'app.cjs');
  let restartCount = 0;
  let lastRestart = 0;
  
  console.log(`[cluster] Primary PID=${process.pid}`);
  
  // Fork the worker
  const worker = cluster.fork();
  
  cluster.on('exit', (worker, code, signal) => {
    const now = Date.now();
    const elapsed = now - lastRestart;
    console.log(`[cluster] Worker exited: code=${code} signal=${signal} pid=${worker.process.pid}`);
    
    // Crash loop protection: if restart within 3s, wait longer
    const delay = elapsed < 3000 ? 5000 : 1000;
    
    setTimeout(() => {
      restartCount++;
      lastRestart = Date.now();
      console.log(`[cluster] Restarting worker (#${restartCount})...`);
      cluster.fork();
    }, delay);
  });
  
  lastRestart = Date.now();
  
  // Ignore signals to keep primary alive
  process.on('SIGHUP', () => console.log('[cluster] Ignored SIGHUP'));
  
} else {
  // Worker process: load the actual server
  require('./app.cjs');
}
