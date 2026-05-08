'use strict';

/**
 * File-based logger used by the legacy product-options module for verbose
 * per-request diagnostics. Writes to <repo>/logs/test-log-<timestamp>.txt
 * and rotates the oldest files when more than 5 exist.
 */

const fs   = require('fs');
const path = require('path');

let initialized = false;
let logFilePath = '';
/** @type {fs.WriteStream | null} */
let logStream = null;

function initLogger() {
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  } else {
    try {
      const names = fs.readdirSync(logsDir).filter((f) => f.endsWith('.txt'));
      const withTime = names.map((name) => ({
        name,
        mtimeMs: fs.statSync(path.join(logsDir, name)).mtimeMs,
      }));
      withTime.sort((a, b) => a.mtimeMs - b.mtimeMs);
      while (withTime.length >= 5) {
        const oldest = withTime.shift();
        fs.unlinkSync(path.join(logsDir, oldest.name));
      }
    } catch (e) {
      console.error('[ERROR] [fileLogger] log cleanup failed:', e.message);
    }
  }

  const fileName = `test-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  logFilePath = path.join(logsDir, fileName);

  logStream = fs.createWriteStream(logFilePath, { flags: 'a', encoding: 'utf8' });
  logStream.on('error', (err) => {
    console.error('[ERROR] [fileLogger] write stream error:', err.message);
  });

  const ts = new Date().toISOString();
  logStream.write(`[${ts}] === LOG FILE INITIALIZED ===\n[${ts}] Log file: ${logFilePath}\n`);
}

function logToFile(message) {
  if (!initialized) {
    initLogger();
    initialized = true;
  }
  const ts = new Date().toISOString();
  logStream.write(`[${ts}] ${message}\n`);
}

function getLogFilePath() {
  if (!initialized) {
    initLogger();
    initialized = true;
  }
  return logFilePath;
}

module.exports = { logToFile, getLogFilePath };
