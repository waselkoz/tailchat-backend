const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const getOrCreatePrivateChat = async (req, res) => {
  try {
    const { userId } = req.body;
    const otherUser = await User.findById(userId);
    if (!otherUser) return res.status(404).json({ error: 'User not found' });
    let chat = await Chat.findOne({ isGroup: false, participants: { $all: [req.userId, userId], $size: 2 } }).populate('participants', '-password');
    if (!chat) {
      chat = new Chat({ participants: [req.userId, userId], isGroup: false });
      await chat.save();
      await chat.populate('participants', '-password');
    }
    res.json({ success: true, chat });
  } catch (error) {
    console.error('GetOrCreatePrivateChat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const createGroupChat = async (req, res) => {
  try {
    const { name, participants = [], avatar } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Group name required' });
    const allParticipants = [req.userId, ...participants];
    const chat = new Chat({ name, participants: allParticipants, isGroup: true, admin: req.userId, avatar: avatar || '' });
    await chat.save();
    await chat.populate('participants', '-password');
    const io = req.app.get('io');
    if (io) {
      allParticipants.forEach(id => io.to(`user:${id}`).emit('chat:new', chat));
    }
    res.status(201).json({ success: true, chat });
  } catch (error) {
    console.error('CreateGroupChat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const getUserChats = async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.userId }).populate('participants', '-password').populate('lastMessage').sort({ updatedAt: -1 });
    const chatsWithUnread = chats.map(chat => {
      const chatObj = chat.toObject();
      const unreadCount = chat.unreadCount?.get(req.userId.toString()) || 0;
      return { ...chatObj, unreadCount };
    });
    res.json({ success: true, chats: chatsWithUnread });
  } catch (error) {
    console.error('GetUserChats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const getChatById = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id).populate('participants', '-password').populate('lastMessage');
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (!chat.participants.some(p => p._id.toString() === req.userId)) return res.status(403).json({ error: 'Access denied' });
    if (chat.unreadCount && chat.unreadCount.get(req.userId.toString())) {
      chat.unreadCount.set(req.userId.toString(), 0);
      await chat.save();
    }
    res.json({ success: true, chat });
  } catch (error) {
    console.error('GetChatById error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const getChatMessages = async (req, res) => {
  try {
    const { id: chatId } = req.params;
    const { limit = 50, before } = req.query;
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.participants.includes(req.userId)) return res.status(403).json({ error: 'Access denied' });
    const query = { chatId, deleted: false };
    if (before) query.createdAt = { $lt: new Date(before) };
    const messages = await Message.find(query).populate('sender', '-password').populate('replyTo').sort({ createdAt: -1 }).limit(parseInt(limit));
    res.json({ success: true, messages: messages.reverse() });
  } catch (error) {
    console.error('GetChatMessages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const updateGroupChat = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, avatar } = req.body;
    const chat = await Chat.findById(id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (chat.isGroup && chat.admin.toString() !== req.userId) return res.status(403).json({ error: 'Admin only' });
    if (name) chat.name = name;
    if (avatar) chat.avatar = avatar;
    await chat.save();
    await chat.populate('participants', '-password');
    const io = req.app.get('io');
    if (io) {
      chat.participants.forEach(p => io.to(`user:${p._id}`).emit('chat:updated', chat));
    }
    res.json({ success: true, chat });
  } catch (error) {
    console.error('UpdateGroupChat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const addParticipants = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;
    const chat = await Chat.findById(id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (chat.isGroup && chat.admin.toString() !== req.userId) return res.status(403).json({ error: 'Admin only' });
    const newParticipants = userIds.filter(uid => !chat.participants.includes(uid));
    chat.participants.push(...newParticipants);
    await chat.save();
    await chat.populate('participants', '-password');
    const io = req.app.get('io');
    if (io) {
      chat.participants.forEach(p => io.to(`user:${p._id}`).emit('chat:updated', chat));
    }
    res.json({ success: true, chat });
  } catch (error) {
    console.error('AddParticipants error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const deleteChat = async (req, res) => {
  try {
    const { id } = req.params;
    const chat = await Chat.findById(id);
    if (!chat || !chat.participants.includes(req.userId)) return res.status(403).json({ error: 'Access denied' });
    chat.deleted = true;
    chat.deletedAt = new Date();
    chat.deletedBy = req.userId;
    await chat.save();
    const io = req.app.get('io');
    if (io) {
      chat.participants.forEach(id => io.to(`user:${id}`).emit('chat:deleted', { chatId: id }));
    }
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('DeleteChat error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const removeParticipant = async (req, res) => {
  try {
    const { id, userId } = req.params;
    const chat = await Chat.findById(id);
    if (!chat.isGroup || chat.admin.toString() !== req.userId) return res.status(403).json({ error: 'Admin only' });
    chat.participants = chat.participants.filter(p => p.toString() !== userId);
    await chat.save();
    res.json({ success: true, chat });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
const leaveGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const chat = await Chat.findById(id);
    if (!chat.isGroup) return res.status(400).json({ error: 'Not a group' });
    chat.participants = chat.participants.filter(p => p.toString() !== req.userId);
    if (chat.admin.toString() === req.userId && chat.participants.length > 0) chat.admin = chat.participants[0];
    await chat.save();
    res.json({ success: true, message: 'Left' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
module.exports = {
  getOrCreatePrivateChat,
  createGroupChat,
  getUserChats,
  getChatById,
  getChatMessages,
  updateGroupChat,
  addParticipants,
  deleteChat,
  removeParticipant,
  leaveGroup,
};