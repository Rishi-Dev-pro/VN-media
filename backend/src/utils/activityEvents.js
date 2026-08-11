/**
 * Centralized activity event type definitions and target type constants.
 */
const EVENT_TYPES = {
  USER_FOLLOWED: 'USER_FOLLOWED',
  VOICE_NOTE_PUBLISHED: 'VOICE_NOTE_PUBLISHED',
  VOICE_NOTE_LIKED: 'VOICE_NOTE_LIKED',
  ALBUM_CREATED: 'ALBUM_CREATED',
  COMMENT_CREATED: 'COMMENT_CREATED',
};

const TARGET_TYPES = {
  USER: 'User',
  VOICE_NOTE: 'VoiceNote',
  ALBUM: 'Album',
};

module.exports = {
  EVENT_TYPES,
  TARGET_TYPES,
};
