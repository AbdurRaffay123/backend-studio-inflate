'use strict';

const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, BUCKET_NAME } = require('../config/aws');
const { upload } = require('../config/multer');
const { logToFile } = require('../../../../shared/utils/fileLogger');
const { buildPublicUploadUrl } = require('../utils/uploadPublicUrl');

function handleMulterUpload(req, res) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.message === 'Only image files are allowed') {
        return res.status(400).json({
          error:   'Invalid file type',
          message: 'Only image files (JPEG, PNG, GIF, WebP) are allowed',
        });
      }
      logToFile('\n--- /api/apps/product-options/upload Multer Error ---');
      logToFile(`Error: ${err.message}`);
      console.error('[ERROR] Upload multer:', err);
      return res.status(500).json({
        success: false,
        error:   'Failed to upload file',
        message: err.message,
      });
    }
    return uploadFile(req, res);
  });
}

async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const fileName = req.body.fileName || file.originalname;
    const fileKey  = req.body.path ? `${req.body.path}/${fileName}` : fileName;

    const uploadParams = {
      Bucket:      BUCKET_NAME,
      Key:         fileKey,
      Body:        file.buffer,
      ContentType: file.mimetype,
    };

    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);

    const urlMode = (process.env.UPLOAD_RESPONSE_URL_MODE || 'public').trim().toLowerCase();
    let fileUrl;
    if (urlMode === 'presigned') {
      const expiresRaw = Number(process.env.S3_GET_PRESIGN_EXPIRES_SEC);
      const expiresIn  = Number.isFinite(expiresRaw) && expiresRaw > 0
        ? Math.min(expiresRaw, 604800)
        : 3600;
      const getCmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey });
      fileUrl = await getSignedUrl(s3Client, getCmd, { expiresIn });
    } else {
      const region = process.env.AWS_REGION || 'us-east-1';
      fileUrl = buildPublicUploadUrl(fileKey, BUCKET_NAME, region);
    }

    logToFile('\n--- /api/apps/product-options/upload Success ---');
    logToFile(`File: ${fileName}`);
    logToFile(`S3 Key: ${fileKey}`);
    logToFile(`URL: ${fileUrl}`);

    res.json({
      success:     true,
      message:     'File uploaded successfully',
      fileName,
      fileKey,
      url:         fileUrl,
      location:    fileUrl,
      size:        file.size,
      contentType: file.mimetype,
    });
  } catch (error) {
    logToFile('\n--- /api/apps/product-options/upload Error ---');
    logToFile(`Error: ${error.message}`);
    logToFile(`Stack: ${error.stack}`);

    console.error('[ERROR] Upload error:', error);
    res.status(500).json({
      success: false,
      error:   'Failed to upload file',
      message: error.message,
    });
  }
}

module.exports = { uploadFile, handleMulterUpload };
