'use strict';

/**
 * Agent-only authentication middleware.
 *
 * Uses a SEPARATE secret (AGENT_API_KEY) so the storefront key never
 * grants access to the diagnostic /test endpoint.
 *
 * Fail-CLOSED: if AGENT_API_KEY is not configured, every request is denied.
 */
function agentKeyMiddleware(req, res, next) {
  const expected = (process.env.AGENT_API_KEY || '').trim();

  if (!expected) {
    return res.status(401).json({
      error:   'Unauthorized',
      message: 'Agent access is not enabled on this server.',
    });
  }

  const sent = (req.headers['x-agent-key'] || '').trim();
  if (!sent || sent !== expected) {
    return res.status(401).json({
      error:   'Unauthorized',
      message: 'Invalid or missing agent key.',
    });
  }

  next();
}

module.exports = { agentKeyMiddleware };
