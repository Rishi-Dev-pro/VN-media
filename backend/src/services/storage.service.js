const crypto = require('crypto');
const path = require('path');
const config = require('../config/env');
const LocalStorageProvider = require('../providers/storage/LocalStorageProvider');

class StorageService {
  /**
   * @param {StorageProvider} [provider] - Optional initial storage provider
   */
  constructor(provider) {
    const defaultStorageDir = path.isAbsolute(config.audioStoragePath)
      ? config.audioStoragePath
      : path.resolve(__dirname, '../../', config.audioStoragePath);

    this.provider = provider || new LocalStorageProvider(defaultStorageDir);
  }

  /**
   * Set custom storage provider.
   * @param {StorageProvider} provider - Storage provider instance
   */
  setProvider(provider) {
    this.provider = provider;
  }

  /**
   * Generate a safe unique filename using UUID v4 and normalized extension.
   * @param {string} extension - Extension starting with dot or plain string (e.g., ".mp3" or "mp3")
   * @returns {string} Unique filename (e.g., "8f2c9a1e-86a3-4c91-9e2b-2a784d1e9f1a.mp3")
   */
  generateSafeFileName(extension) {
    const cleanExt = extension.startsWith('.') ? extension.slice(1) : extension;
    const normalizedExt = cleanExt.toLowerCase().replace(/[^a-z0-9]/g, '');
    const uuid = crypto.randomUUID();
    return `${uuid}.${normalizedExt}`;
  }

  /**
   * Save audio file buffer to storage.
   * @param {Buffer} fileBuffer - Audio file binary buffer
   * @param {string} extension - File extension (e.g. ".mp3")
   * @returns {Promise<{ storageRef: string, filename: string }>} Storage reference & generated filename
   */
  async saveFile(fileBuffer, extension) {
    const filename = this.generateSafeFileName(extension);
    const storageRef = await this.provider.saveFile(fileBuffer, filename);
    return { storageRef, filename };
  }

  /**
   * Delete file from storage by reference.
   * @param {string} storageRef - Relative storage reference or filename
   * @returns {Promise<boolean>} True if file deleted or already missing
   */
  async deleteFile(storageRef) {
    if (!storageRef) return false;
    return this.provider.deleteFile(storageRef);
  }

  /**
   * Check if file exists in storage.
   * @param {string} storageRef - Relative storage reference or filename
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(storageRef) {
    if (!storageRef) return false;
    return this.provider.fileExists(storageRef);
  }
}

// Export singleton instance by default, allow class instantiation if needed
const defaultStorageService = new StorageService();
defaultStorageService.StorageService = StorageService;

module.exports = defaultStorageService;
