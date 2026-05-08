'use strict';

/**
 * Build the public URL returned after S3 upload (non-presigned mode).
 *
 * When S3_PUBLIC_BASE_URL is set (e.g. CloudFront), key path segments are
 * URL-encoded. When unset, falls back to virtual-hosted-style S3 URLs.
 */
function buildPublicUploadUrl(fileKey, bucket, region) {
  const base = (process.env.S3_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (base) {
    const path = String(fileKey)
      .split('/')
      .map((s) => encodeURIComponent(s))
      .join('/');
    return `${base}/${path}`;
  }
  const r = region || 'us-east-1';
  return `https://${bucket}.s3.${r}.amazonaws.com/${fileKey}`;
}

module.exports = { buildPublicUploadUrl };
