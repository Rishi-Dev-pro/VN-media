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
}

module.exports = StorageProvider;
