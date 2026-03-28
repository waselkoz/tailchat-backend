const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters'],
  },
  type: {
    type: String,
    enum: ['text', 'image', 'voice', 'video', 'file', 'tail', 'system'],
    default: 'text',
  },
  // Media fields
  mediaUrl: {
    type: String,
    default: null,
  },
  mediaDuration: {
    type: Number, // For voice messages (seconds)
    default: null,
  },
  mediaSize: {
    type: Number,
    default: null,
  },
  thumbnail: {
    type: String, // For image/video thumbnails
    default: null,
  },
  // Tail specific fields (for feed posts)
  isTail: {
    type: Boolean,
    default: false,
  },
  tailMetadata: {
    title: { type: String, maxlength: 100 },
    tags: [{ type: String }],
    location: { type: String },
    visibility: { type: String, enum: ['public', 'private', 'followers'], default: 'public' },
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  deliveredTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
  reactions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: { type: String },
    createdAt: { type: Date, default: Date.now },
  }],
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
  }],
  edited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
  },
  deleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Indexes
MessageSchema.index({ chatId: 1, createdAt: -1 });
MessageSchema.index({ isTail: 1, createdAt: -1 });
MessageSchema.index({ 'tailMetadata.tags': 1 });

// Virtual for comment count
MessageSchema.virtual('commentCount').get(function() {
  return this.comments?.length || 0;
});

// Virtual for reaction count
MessageSchema.virtual('reactionCount').get(function() {
  return this.reactions?.length || 0;
});

module.exports = mongoose.model('Message', MessageSchema);