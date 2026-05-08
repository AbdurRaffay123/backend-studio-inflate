'use strict';

/**
 * Shared Mongoose connection lifecycle.
 *
 * Responsibilities:
 *  - Open a Mongoose connection with a bounded retry loop on startup.
 *  - Maintain an `isReady()` probe that reflects the live connection state.
 *  - Close the connection cleanly on SIGTERM / SIGINT so in-flight writes
 *    have a chance to flush before the process exits.
 *
 * The CRM module owns the database, but db readiness is exposed here so
 * the global /health endpoint can reflect it.
 */

const mongoose = require('mongoose');
const logger   = require('../utils/logger');

const MAX_CONNECT_ATTEMPTS = 5;
const SHUTDOWN_TIMEOUT_MS  = 10_000;

let _ready        = false;
let _shuttingDown = false;

// Listeners are attached once at module load; they survive across reconnects.
mongoose.connection.on('connected', () => {
  _ready = true;
  logger.info('MongoDB connected');
});

mongoose.connection.on('disconnected', () => {
  _ready = false;
  if (!_shuttingDown) logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  _ready = false;
  logger.error({ err }, 'MongoDB error');
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Connect to MongoDB with exponential back-off. Throws after exhausting
 * MAX_CONNECT_ATTEMPTS so the caller (index.js) can decide whether to
 * crash the process or run with a degraded /health response.
 */
const connect = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  let lastErr;
  for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS:          45_000,
      });
      return;
    } catch (err) {
      lastErr = err;
      // 1s, 2s, 4s, 8s — capped at 16s
      const backoffMs = Math.min(16_000, 1_000 * 2 ** (attempt - 1));
      logger.warn(
        { err: err.message, attempt, maxAttempts: MAX_CONNECT_ATTEMPTS, backoffMs },
        'MongoDB connect attempt failed, retrying'
      );
      if (attempt < MAX_CONNECT_ATTEMPTS) await sleep(backoffMs);
    }
  }

  throw new Error(
    `Failed to connect to MongoDB after ${MAX_CONNECT_ATTEMPTS} attempts: ${lastErr?.message}`
  );
};

/**
 * Close the Mongoose connection. Safe to call multiple times.
 */
const disconnect = async () => {
  _shuttingDown = true;
  if (mongoose.connection.readyState === 0) return;
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (err) {
    logger.error({ err }, 'Error closing MongoDB connection');
  }
};

const isReady = () => _ready;

// ── Graceful shutdown signal handlers ────────────────────────────────────────
// Use process.once so a second signal during shutdown still terminates the
// process via Node's default behavior. Each handler races against
// SHUTDOWN_TIMEOUT_MS so a hung Mongo close doesn't pin the process forever.
const handleSignal = (signal) => async () => {
  if (_shuttingDown) return;
  logger.info({ signal }, 'Shutdown signal received — closing MongoDB');

  const timeout = sleep(SHUTDOWN_TIMEOUT_MS).then(() => {
    logger.warn({ ms: SHUTDOWN_TIMEOUT_MS }, 'MongoDB close timed out; forcing exit');
  });

  await Promise.race([disconnect(), timeout]);
  process.exit(0);
};

process.once('SIGTERM', handleSignal('SIGTERM'));
process.once('SIGINT',  handleSignal('SIGINT'));

module.exports = { connect, disconnect, isReady };
