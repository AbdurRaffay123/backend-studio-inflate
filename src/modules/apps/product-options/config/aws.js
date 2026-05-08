'use strict';

const { S3Client } = require('@aws-sdk/client-s3');
const logger = require('../../../../shared/utils/logger');

const BUCKET_NAME = (process.env.S3_BUCKET_NAME || '').trim();

if (!BUCKET_NAME) {
  logger.warn('S3_BUCKET_NAME is not set — image uploads will fail with 503 until this is configured');
}
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  logger.warn('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set — S3 requests will use the instance role (or fail)');
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

module.exports = { s3Client, BUCKET_NAME };
