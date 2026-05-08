'use strict';

const multer = require('multer');

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
  fileFilter(req, file, cb) {
    if (ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'), false);
  },
});

module.exports = { upload };
