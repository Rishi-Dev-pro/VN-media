const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation ID is required'],
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
      index: true,
    },
    content: {
      type: String,
      required: [
        function () {
          return this.messageType === 'text';
        },
        'Message content is required for text messages',
      ],
      trim: true,
      maxlength: [5000, 'Message content cannot exceed 5000 characters'],
    },
    messageType: {
      type: String,
      enum: {
        values: ['text', 'audio'],
        message: 'Unsupported message type: {VALUE}',
      },
      default: 'text',
    },
    audioUrl: {
      type: String,
      default: null,
    },
    duration: {
      type: Number,
      default: null,
    },
    mimeType: {
      type: String,
      default: null,
    },
    fileSize: {
      type: Number,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying message history in chronological order
messageSchema.index({ conversationId: 1, deletedAt: 1, createdAt: 1 });

// Compound index for batching unread counts and read state updates
messageSchema.index({ conversationId: 1, senderId: 1, readAt: 1, deletedAt: 1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
