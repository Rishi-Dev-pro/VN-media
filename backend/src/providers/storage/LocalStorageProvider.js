const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const StorageProvider = require('./StorageProvider');

/**
 * Local filesystem implementation of StorageProvider.
 */
class LocalStorageProvider extends StorageProvider {
  /**
   * @param {string} [baseDir] - Target directory path for storing files
   */
  constructor(baseDir) {
    super();
    this.baseDir = baseDir
      ? path.resolve(baseDir)
      : path.resolve(__dirname, '../../../storage/audio');
  }

  /**
   * Ensure storage directory exists.
   * @private
   */
  async _ensureDir() {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  /**
   * Resolve a safe absolute file path within baseDir.
   * Prevents path traversal attempts (e.g. "../../something").
   * @private
   * @param {string} storageRef - Relative reference or filename
   * @returns {string} Safe absolute file path
   */
  _getSafePath(storageRef) {
    const filename = path.basename(storageRef);
    const safePath = path.resolve(this.baseDir, filename);

    if (!safePath.startsWith(this.baseDir)) {
      throw new Error('Access denied: Invalid storage reference path.');
    }

    return safePath;
  }

  /**
   * Save a file buffer to local disk.
   * @param {Buffer} fileBuffer - File binary data
   * @param {string} filename - Unique target filename
   * @returns {Promise<string>} Storage reference identifier (e.g., "audio/<filename>")
   */
  async saveFile(fileBuffer, filename) {
    await this._ensureDir();
    const safePath = this._getSafePath(filename);
    await fs.writeFile(safePath, fileBuffer);
    const safeFilename = path.basename(safePath);
    return `audio/${safeFilename}`;
  }

  /**
   * Delete a file from local disk.
   * @param {string} storageRef - Relative storage reference or filename
   * @returns {Promise<boolean>} True if deleted or already missing
   */
  async deleteFile(storageRef) {
    try {
      const safePath = this._getSafePath(storageRef);
      await fs.unlink(safePath);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Gracefully handle missing file
        return true;
      }
      throw err;
    }
  }

  /**
   * Check if a stored file exists on local disk.
   * @param {string} storageRef - Relative storage reference or filename
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(storageRef) {
    try {
      const safePath = this._getSafePath(storageRef);
      await fs.access(safePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a readable stream for a stored file on local disk.
   * @param {string} storageRef - Relative storage reference
   * @param {object} [options] - Stream options (e.g. { start, end })
   * @returns {fs.ReadStream} Node.js fs.ReadStream
   */
  createReadStream(storageRef, options) {
    const safePath = this._getSafePath(storageRef);
    return fsSync.createReadStream(safePath, options);
  }

  /**
   * Get stats for a stored file on local disk.
   * @param {string} storageRef - Relative storage reference
   * @returns {Promise<{ size: number }>} File stats
   */
  async getFileStats(storageRef) {
    const safePath = this._getSafePath(storageRef);
    const stats = await fs.stat(safePath);
    return {
      size: stats.size,
      mtime: stats.mtime,
    };
  }
}

module.exports = LocalStorageProvider;
