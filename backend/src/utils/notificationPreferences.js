/**
 * Centralized notification preference constants.
 */
const PREFERENCE_KEYS = {
  USER_FOLLOWED: 'userFollowed',
  VOICE_NOTE_LIKED: 'voiceNoteLiked',
};

const DEFAULT_PREFERENCES = {
  userFollowed: true,
  voiceNoteLiked: true,
};

module.exports = {
  PREFERENCE_KEYS,
  DEFAULT_PREFERENCES,
};
