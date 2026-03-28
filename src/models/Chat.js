const mongoose = require('mongoose');
const ChatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  isGroup: { type: Boolean, default: false },
  name: { type: String, trim: true, required: function() { return this.isGroup === true; }, maxlength: [50, 'Max 50 chars'] },
  avatar: { type: String, default: '' },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: function() { return this.isGroup === true; } },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  unreadCount: { type: Map, of: Number, default: {} },
  isPublic: { type: Boolean, default: false },
  description: { type: String, maxlength: 500, default: '' },
}, { timestamps: true });
ChatSchema.index({ participants: 1 });
ChatSchema.index({ updatedAt: -1 });
ChatSchema.methods.isParticipant = function(userId) { return this.participants.includes(userId); };
ChatSchema.methods.getDisplayName = function(userId) {
  if (this.isGroup) return this.name;
  const other = this.participants.find(p => p.toString() !== userId.toString());
  return other ? other.username : 'Unknown';
};
ChatSchema.methods.getAvatar = function(userId) {
  if (this.isGroup) return this.avatar || '';
  const other = this.participants.find(p => p.toString() !== userId.toString());
  return other ? other.avatar : '';
};
module.exports = mongoose.model('Chat', ChatSchema);