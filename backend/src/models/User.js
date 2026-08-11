const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [
        /^[a-zA-Z0-9_]+$/,
        'Username can only contain letters, numbers, and underscores',
      ],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\S+@\S+\.\S+$/,
        'Please provide a valid email address',
      ],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    avatar: {
      type: String,
      default: null,
      trim: true,
    },
    bio: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Note: unique: true on username and email automatically creates unique indexes.

const User = mongoose.model('User', userSchema);

module.exports = User;
