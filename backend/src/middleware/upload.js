const multer = require('multer');
const config = require('../config/env');

// Configure Multer in-memory storage for audio processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxAudioSizeBytes,
    files: 1,
  },
});

/**
 * Middleware wrapper for handling single audio file upload.
 * Catches Multer limits and format errors cleanly.
 */
const uploadSingleAudio = (req, res, next) => {
  const singleHandler = upload.single('audio');

  singleHandler(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const sizeError = new Error(
            `File size exceeds maximum limit of ${config.maxAudioFileSizeMB}MB`
          );
          sizeError.statusCode = 413;
          return next(sizeError);
        }

        const multerError = new Error(`File upload error: ${err.message}`);
        multerError.statusCode = 400;
        return next(multerError);
      }
      return next(err);
    }
    next();
  });
};

module.exports = {
  uploadSingleAudio,
};
