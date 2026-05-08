#!/usr/bin/env node
'use strict';

/**
 * Generate a bcrypt hash for ADMIN_PASSWORD_HASH:
 *
 *   npm run generate:admin-hash -- <your-password>
 */

const bcrypt = require('bcryptjs');

const [, , password] = process.argv;

if (!password || password.length < 8) {
  console.error('\nUsage: npm run generate:admin-hash -- <password-min-8-chars>\n');
  process.exit(1);
}

bcrypt.hash(password, 12).then((hash) => {
  console.log('\nAdd this line to your .env file:\n');
  console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
}).catch((err) => {
  console.error('Hash error:', err.message);
  process.exit(1);
});
