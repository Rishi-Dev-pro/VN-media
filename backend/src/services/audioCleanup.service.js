const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const Message = require('../models/Message');
const VoiceNote = require('../models/VoiceNote');
const storageService = require('./storage.service');

class AudioCleanupService {
  /**
   * Calculate retention cutoff date based on retention days parameter or default config.
   *
   * @param {number} [retentionDays] - Days to retain soft-deleted audio files
   * @returns {Date} Cutoff date (messages soft-deleted <= cutoffDate are eligible for physical cleanup)
   */
  getRetentionCutoffDate(retentionDays) {
    let days = parseInt(retentionDays, 10);
    if (isNaN(days) || days < 0) {
      days = config.audioDeletedRetentionDays;
    }

    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  /**
   * Perform permanent physical file cleanup for soft-deleted audio messages past retention period.
   * Preserves Message document in MongoDB for relational and historical integrity.
   *
   * @param {object} [options]
   * @param {number} [options.retentionDays] - Custom retention period in days
   * @param {number} [options.batchSize=100] - Maximum candidate messages to process per batch
   * @returns {Promise<{ scanned: number, eligible: number, deleted: number, alreadyMissing: number, failed: number, cutoffDate: string }>}
   */
  async cleanupDeletedAudioMessages({ retentionDays, batchSize = 100 } = {}) {
    const cutoffDate = this.getRetentionCutoffDate(retentionDays);

    const parsedBatch = parseInt(batchSize, 10);
    const limit = isNaN(parsedBatch) || parsedBatch < 1 ? 100 : Math.min(1000, parsedBatch);

    const filter = {
      messageType: 'audio',
      deletedAt: { $ne: null, $lte: cutoffDate },
      audioUrl: { $ne: null },
    };

    const candidates = await Message.find(filter).limit(limit);

    let deleted = 0;
    let alreadyMissing = 0;
    let failed = 0;

    for (const candidate of candidates) {
      const storageRef = candidate.audioUrl;
      if (!storageRef || typeof storageRef !== 'string') continue;

      // Duplicate reference protection: Check if another Message references the exact same storage file
      const otherRef = await Message.countDocuments({
        audioUrl: storageRef,
        _id: { $ne: candidate._id },
      });

      if (otherRef > 0) {
        // Skip physical file deletion to protect shared storage reference
        continue;
      }

      try {
        const exists = await storageService.fileExists(storageRef);
        if (!exists) {
          alreadyMissing++;
          continue;
        }

        const success = await storageService.deleteFile(storageRef);
        if (success) {
          deleted++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
      }
    }

    return {
      scanned: candidates.length,
      eligible: candidates.length,
      deleted,
      alreadyMissing,
      failed,
      cutoffDate: cutoffDate.toISOString(),
    };
  }

  /**
   * Conservatively scan storage directory for orphan audio files without active DB references.
   *
   * @returns {Promise<{ scanned: number, orphans: Array<{ filename: string, storageRef: string }> }>}
   */
  async detectOrphanAudioFiles() {
    let storageDir = '';
    try {
      storageDir = path.isAbsolute(config.audioStoragePath)
        ? config.audioStoragePath
        : path.resolve(__dirname, '../../', config.audioStoragePath);
    } catch {
      storageDir = path.resolve(__dirname, '../../storage/audio');
    }

    if (!fs.existsSync(storageDir)) {
      return { scanned: 0, orphans: [] };
    }

    const files = fs.readdirSync(storageDir);
    const orphans = [];

    for (const filename of files) {
      const fullPath = path.join(storageDir, filename);

      // Verify regular file (prevent traversing subdirectories or symlinks outside root)
      try {
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;
      } catch {
        continue;
      }

      const ref1 = `audio/${filename}`;
      const ref2 = `uploads/audio/${filename}`;
      const ref3 = `/uploads/audio/${filename}`;
      const ref4 = filename;

      // Check DB references in Message and VoiceNote
      const msgCount = await Message.countDocuments({
        audioUrl: { $in: [ref1, ref2, ref3, ref4] },
      });
      const vnCount = await VoiceNote.countDocuments({
        audioUrl: { $in: [ref1, ref2, ref3, ref4] },
      });

      if (msgCount === 0 && vnCount === 0) {
        orphans.push({
          filename,
          storageRef: ref1,
        });
      }
    }

    return {
      scanned: files.length,
      orphans,
    };
  }
}

module.exports = new AudioCleanupService();
