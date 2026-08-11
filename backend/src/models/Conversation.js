const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participantOne: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Participant one is required'],
      index: true,
    },
    participantTwo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Participant two is required'],
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    lastMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Database-level compound unique index to enforce exactly one 1-to-1 conversation per user pair
conversationSchema.index({ participantOne: 1, participantTwo: 1 }, { unique: true });

// Compound indexes for fast conversation listing per participant
conversationSchema.index({ participantOne: 1, lastMessageAt: -1, _id: -1 });
conversationSchema.index({ participantTwo: 1, lastMessageAt: -1, _id: -1 });

/**
 * Helper to deterministically sort two User IDs lexicographically
 * ensuring participantOne is always < participantTwo stringwise.
 *
 * @param {string|object} userAId
 * @param {string|object} userBId
 * @returns {{ participantOne: mongoose.Types.ObjectId, participantTwo: mongoose.Types.ObjectId }}
 */
conversationSchema.statics.getParticipantPair = function (userAId, userBId) {
  const strA = userAId ? userAId.toString() : '';
  const strB = userBId ? userBId.toString() : '';

  const sorted = [strA, strB].sort();

  return {
    participantOne: new mongoose.Types.ObjectId(sorted[0]),
    participantTwo: new mongoose.Types.ObjectId(sorted[1]),
  };
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
