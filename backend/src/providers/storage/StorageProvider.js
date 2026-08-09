/**
 * Abstract StorageProvider interface.
 * Defines the contract for all storage providers (LocalStorageProvider, CloudStorageProvider, etc.).
 */
class StorageProvider {
  /**
   * Save a file buffer to storage.
   * @param {Buffer} fileBuffer - File binary data
   * @param {string} filename - Unique target filename
   * @returns {Promise<string>} Storage reference identifier
   */
  async saveFile(fileBuffer, filename) {
    throw new Error('Method saveFile() must be implemented.');
  }

  /**
   * Delete a stored file by its storage reference.
   * @param {string} storageRef - Relative storage reference
   * @returns {Promise<boolean>} True if deleted or already missing
   */
  async deleteFile(storageRef) {
    throw new Error('Method deleteFile() must be implemented.');
  }

  /**
   * Check if a stored file exists.
   * @param {string} storageRef - Relative storage reference
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(storageRef) {
    throw new Error('Method fileExists() must be implemented.');
  }

  /**
   * Create a readable stream for a stored file.
   * @param {string} storageRef - Relative storage reference
   * @param {object} [options] - Stream options (e.g. { start, end })
   * @returns {ReadableStream|object} Node.js ReadableStream
   */
  createReadStream(storageRef, options) {
    throw new Error('Method createReadStream() must be implemented.');
  }

  /**
   * Get file metadata/stats (e.g., size).
   * @param {string} storageRef - Relative storage reference
   * @returns {Promise<{ size: number }>} File stats
   */
  async getFileStats(storageRef) {
    throw new Error('Method getFileStats() must be implemented.');
  }
}

module.exports = StorageProvider;
