const path = require('path');
const musicMetadata = require('music-metadata');

// Allowed file extensions
const ALLOWED_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg']);

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/x-mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/aac',
  'audio/x-aac',
  'audio/ogg',
  'application/ogg',
]);

class AudioService {
  /**
   * Check if file extension is allowed.
   * @param {string} originalFilename
   * @returns {boolean}
   */
  isValidExtension(originalFilename) {
    if (!originalFilename) return false;
    const ext = path.extname(originalFilename).toLowerCase();
    return ALLOWED_EXTENSIONS.has(ext);
  }

  /**
   * Check if MIME type is allowed.
   * @param {string} mimeType
   * @returns {boolean}
   */
  isValidMimeType(mimeType) {
    if (!mimeType) return false;
    return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
  }

  /**
   * Inspect binary buffer magic bytes to verify audio container signatures.
   * @param {Buffer} buffer
   * @returns {boolean}
   */
  validateMagicBytes(buffer) {
    if (!buffer || buffer.length < 4) return false;

    // ID3v2 tag (MP3)
    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
      return true;
    }

    // MP3 frame sync (0xFF 0xFB, 0xFF 0xF3, 0xFF 0xF2, 0xFF 0xE3)
    if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
      return true;
    }

    // RIFF (WAV)
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46
    ) {
      if (
        buffer.length >= 12 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x41 &&
        buffer[10] === 0x56 &&
        buffer[11] === 0x45
      ) {
        return true;
      }
    }

    // OggS (OGG)
    if (
      buffer[0] === 0x4f &&
      buffer[1] === 0x67 &&
      buffer[2] === 0x67 &&
      buffer[3] === 0x53
    ) {
      return true;
    }

    // ftyp (M4A / MP4 container)
    if (
      buffer.length >= 8 &&
      buffer[4] === 0x66 &&
      buffer[5] === 0x74 &&
      buffer[6] === 0x79 &&
      buffer[7] === 0x70
    ) {
      return true;
    }

    return false;
  }

  /**
   * Validate audio file and extract duration using music-metadata.
   * @param {Buffer} buffer - File buffer
   * @param {string} originalFilename - Original filename
   * @param {string} mimeType - Uploaded MIME type
   * @returns {Promise<{ extension: string, duration: number }>}
   */
  async validateAndExtractMetadata(buffer, originalFilename, mimeType) {
    if (!buffer || buffer.length === 0) {
      const err = new Error('Audio file content is empty or missing.');
      err.statusCode = 400;
      throw err;
    }

    const ext = path.extname(originalFilename || '').toLowerCase();
    if (!this.isValidExtension(originalFilename)) {
      const err = new Error(
        `Unsupported audio format extension: ${ext || 'none'}. Allowed: MP3, WAV, M4A, AAC, OGG.`
      );
      err.statusCode = 400;
      throw err;
    }

    if (!this.isValidMimeType(mimeType)) {
      const err = new Error(
        `Unsupported audio MIME type: ${mimeType}. Allowed: audio/mpeg, audio/wav, audio/m4a, audio/aac, audio/ogg.`
      );
      err.statusCode = 400;
      throw err;
    }

    if (!this.validateMagicBytes(buffer)) {
      const err = new Error(
        'Invalid audio file signature. File content does not match supported audio magic bytes.'
      );
      err.statusCode = 400;
      throw err;
    }

    let metadata;
    try {
      metadata = await musicMetadata.parseBuffer(buffer, mimeType, { duration: true });
    } catch (parseError) {
      const err = new Error(
        'Corrupted or unreadable audio file. Failed to parse audio metadata.'
      );
      err.statusCode = 400;
      throw err;
    }

    const rawDuration = metadata?.format?.duration;
    if (typeof rawDuration !== 'number' || isNaN(rawDuration) || rawDuration <= 0) {
      // Fallback: If duration is missing but buffer was parsed cleanly
      const err = new Error(
        'Could not extract valid audio duration from the provided file.'
      );
      err.statusCode = 400;
      throw err;
    }

    const duration = Math.round(rawDuration * 100) / 100; // Round to 2 decimal places

    return {
      extension: ext,
      duration,
    };
  }
}

module.exports = new AudioService();
