const mongoose = require('mongoose');
const Download = require('../models/Download');
const Message = require('../models/Message');
const voiceNoteService = require('./voiceNote.service');
const messageService = require('./message.service');

class DownloadService {
  /**
   * Format Download document into safe client DTO.
   */
  formatDownload(download) {
    if (!download) return null;
    const obj = typeof download.toObject === 'function' ? download.toObject() : download;
    const isRevoked = obj.status === 'revoked';

    return {
      id: obj._id ? obj._id.toString() : obj.id,
      userId: obj.userId ? obj.userId.toString() : null,
      mediaType: obj.mediaType,
      voiceNoteId: obj.voiceNoteId ? obj.voiceNoteId.toString() : null,
      messageId: obj.messageId ? obj.messageId.toString() : null,
      conversationId: obj.conversationId ? obj.conversationId.toString() : null,
      deviceId: obj.deviceId || 'default_device',
      status: obj.status,
      fileSize: isRevoked ? null : (obj.fileSize || null),
      mimeType: isRevoked ? null : (obj.mimeType || null),
      downloadUrl: isRevoked ? null : (obj.downloadUrl || null),
      errorMessage: obj.errorMessage || null,
      lastAccessedAt: obj.lastAccessedAt,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    };
  }

  /**
   * Initiate or retrieve an existing download tracking record for a VoiceNote or private audio Message.
   * Enforces media access authorization at request time.
   */
  async initiateDownload({ reqUser, mediaType, voiceNoteId, messageId, deviceId }) {
    if (!reqUser || !reqUser._id) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!mediaType || !['voicenote', 'message_audio'].includes(mediaType)) {
      const err = new Error('Invalid mediaType. Allowed: voicenote, message_audio');
      err.statusCode = 400;
      throw err;
    }

    const hasVn = Boolean(voiceNoteId);
    const hasMsg = Boolean(messageId);
    if ((hasVn && hasMsg) || (!hasVn && !hasMsg)) {
      const err = new Error('Must provide exactly one target media ID (voiceNoteId or messageId)');
      err.statusCode = 400;
      throw err;
    }

    const sanitizedDeviceId = deviceId && typeof deviceId === 'string'
      ? deviceId.trim().slice(0, 100)
      : 'default_device';

    let downloadInfo = null;
    let downloadUrl = null;
    let targetConvId = null;

    if (mediaType === 'voicenote') {
      downloadInfo = await voiceNoteService.getVoiceNoteDownloadInfo({
        voiceNoteId,
        user: reqUser,
      });
      downloadUrl = `/api/vns/${voiceNoteId}/download`;
    } else if (mediaType === 'message_audio') {
      const messageDoc = await Message.findById(messageId);
      if (!messageDoc) {
        const err = new Error('Message not found');
        err.statusCode = 404;
        throw err;
      }
      targetConvId = messageDoc.conversationId ? messageDoc.conversationId.toString() : null;

      downloadInfo = await messageService.getAudioMessageDownloadInfo({
        conversationId: targetConvId,
        messageId,
        currentUserId: reqUser._id,
      });
      downloadUrl = `/api/conversations/${targetConvId}/messages/${messageId}/download`;
    }

    const filter = {
      userId: reqUser._id,
      mediaType,
      voiceNoteId: voiceNoteId || null,
      messageId: messageId || null,
      deviceId: sanitizedDeviceId,
    };

    const update = {
      $setOnInsert: {
        status: 'pending',
        conversationId: targetConvId || (downloadInfo && downloadInfo.conversationId) || null,
      },
      $set: {
        fileSize: downloadInfo.fileSize,
        mimeType: downloadInfo.mimeType,
        downloadUrl,
        lastAccessedAt: new Date(),
      },
    };

    const downloadDoc = await Download.findOneAndUpdate(filter, update, {
      new: true,
      upsert: true,
      runValidators: true,
    });

    return this.formatDownload(downloadDoc);
  }

  /**
   * Update download lifecycle status (pending, active, completed, failed, revoked).
   * Enforces strict server-side state machine and re-evaluates media authorization.
   */
  async updateDownloadStatus({ downloadId, reqUser, status, errorMessage }) {
    if (!reqUser || !reqUser._id) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!downloadId || !mongoose.Types.ObjectId.isValid(downloadId.toString())) {
      const err = new Error('Download record not found');
      err.statusCode = 404;
      throw err;
    }

    const validStatuses = ['pending', 'active', 'completed', 'failed', 'revoked'];
    if (!status || !validStatuses.includes(status)) {
      const err = new Error(`Invalid status. Allowed: ${validStatuses.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const downloadDoc = await Download.findOne({ _id: downloadId, userId: reqUser._id });
    if (!downloadDoc) {
      const err = new Error('Download record not found');
      err.statusCode = 404;
      throw err;
    }

    const currentStatus = downloadDoc.status;

    // Strict server-side state machine transition matrix
    const ALLOWED_TRANSITIONS = {
      pending: ['active', 'failed', 'pending'],
      active: ['completed', 'failed', 'active'],
      completed: ['completed', 'failed'],
      failed: ['failed', 'active', 'completed'],
      revoked: ['revoked'],
    };

    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(status)) {
      const err = new Error(`Invalid status transition from ${currentStatus} to ${status}`);
      err.statusCode = 400;
      throw err;
    }

    // Dynamic media authorization re-evaluation prior to granting active or completed status
    if (status === 'active' || status === 'completed') {
      try {
        if (downloadDoc.mediaType === 'voicenote' && downloadDoc.voiceNoteId) {
          await voiceNoteService.getVoiceNoteStreamInfo({ voiceNoteId: downloadDoc.voiceNoteId, user: reqUser });
        } else if (downloadDoc.mediaType === 'message_audio' && downloadDoc.messageId && downloadDoc.conversationId) {
          await messageService.getAudioMessageStreamInfo({
            conversationId: downloadDoc.conversationId,
            messageId: downloadDoc.messageId,
            currentUserId: reqUser._id,
          });
        } else {
          const err = new Error('Invalid target media');
          err.statusCode = 400;
          throw err;
        }
      } catch (accessErr) {
        downloadDoc.status = 'revoked';
        downloadDoc.downloadUrl = null;
        downloadDoc.errorMessage = accessErr.message || 'Media access revoked';
        await downloadDoc.save();

        const err = new Error(accessErr.message || 'Access denied: Media access revoked');
        err.statusCode = accessErr.statusCode || 403;
        throw err;
      }
    }

    downloadDoc.status = status;
    if (errorMessage !== undefined) {
      downloadDoc.errorMessage = errorMessage ? String(errorMessage).slice(0, 250) : null;
    }
    downloadDoc.lastAccessedAt = new Date();
    await downloadDoc.save();

    return this.formatDownload(downloadDoc);
  }

  /**
   * Get user's download records with dynamic authorization re-evaluation.
   */
  async getUserDownloads({ reqUser, page = 1, limit = 20, status }) {
    if (!reqUser || !reqUser._id) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const filter = {
      userId: reqUser._id,
      ...(status && ['pending', 'active', 'completed', 'failed', 'revoked'].includes(status) ? { status } : {}),
    };

    const downloadDocs = await Download.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit);

    // Dynamic authorization re-evaluation on list retrieval
    for (const doc of downloadDocs) {
      if (doc.status === 'revoked') continue;

      try {
        if (doc.mediaType === 'voicenote' && doc.voiceNoteId) {
          await voiceNoteService.getVoiceNoteStreamInfo({ voiceNoteId: doc.voiceNoteId, user: reqUser });
        } else if (doc.mediaType === 'message_audio' && doc.messageId && doc.conversationId) {
          await messageService.getAudioMessageStreamInfo({
            conversationId: doc.conversationId,
            messageId: doc.messageId,
            currentUserId: reqUser._id,
          });
        }
      } catch {
        doc.status = 'revoked';
        doc.downloadUrl = null;
        await doc.save();
      }
    }

    const totalItems = await Download.countDocuments(filter);

    return {
      items: downloadDocs.map((d) => this.formatDownload(d)),
      page: parsedPage,
      limit: parsedLimit,
      totalItems,
      totalPages: Math.ceil(totalItems / parsedLimit) || 1,
    };
  }

  /**
   * Get a single download record by ID with dynamic authorization re-evaluation.
   */
  async getDownloadById({ downloadId, reqUser }) {
    if (!reqUser || !reqUser._id) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!downloadId || !mongoose.Types.ObjectId.isValid(downloadId.toString())) {
      const err = new Error('Download record not found');
      err.statusCode = 404;
      throw err;
    }

    const downloadDoc = await Download.findOne({ _id: downloadId, userId: reqUser._id });
    if (!downloadDoc) {
      const err = new Error('Download record not found');
      err.statusCode = 404;
      throw err;
    }

    // Dynamic authorization re-evaluation
    if (downloadDoc.status !== 'revoked') {
      try {
        if (downloadDoc.mediaType === 'voicenote' && downloadDoc.voiceNoteId) {
          await voiceNoteService.getVoiceNoteStreamInfo({ voiceNoteId: downloadDoc.voiceNoteId, user: reqUser });
        } else if (downloadDoc.mediaType === 'message_audio' && downloadDoc.messageId && downloadDoc.conversationId) {
          await messageService.getAudioMessageStreamInfo({
            conversationId: downloadDoc.conversationId,
            messageId: downloadDoc.messageId,
            currentUserId: reqUser._id,
          });
        }
      } catch {
        downloadDoc.status = 'revoked';
        downloadDoc.downloadUrl = null;
        await downloadDoc.save();
      }
    }

    return this.formatDownload(downloadDoc);
  }
}

module.exports = new DownloadService();
