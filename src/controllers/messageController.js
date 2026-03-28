const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');
const uploadService = require('../services/uploadService');
const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, type = 'text', replyTo } = req.body;
    if (!content || content.trim() === '') return res.status(400).json({ error: 'Content required' });
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.participants.includes(req.userId)) return res.status(403).json({ error: 'Access denied' });
    const message = new Message({ chatId, sender: req.userId, content, type, replyTo: replyTo || null, deliveredTo: [req.userId] });
    await message.save();
    await message.populate('sender', '-password');
    chat.lastMessage = message._id;
    chat.updatedAt = new Date();
    chat.participants.forEach(pId => {
      if (pId.toString() !== req.userId) {
        const current = chat.unreadCount?.get(pId.toString()) || 0;
        chat.unreadCount.set(pId.toString(), current + 1);
      }
    });
    await chat.save();
    const io = req.app.get('io');
    if (io) io.to(`chat:${chatId}`).emit('message:receive', message);
    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('SendMessage error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const sendImage = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No image' });
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.participants.includes(req.userId)) return res.status(403).json({ error: 'Access denied' });
    const imageUrl = uploadService.saveImage(req.file, req.userId);
    const message = new Message({ chatId, sender: req.userId, content: 'Image', type: 'image', mediaUrl: imageUrl, mediaSize: req.file.size, deliveredTo: [req.userId] });
    await message.save();
    await message.populate('sender', '-password');
    chat.lastMessage = message._id;
    chat.updatedAt = new Date();
    await chat.save();
    const io = req.app.get('io');
    if (io) io.to(`chat:${chatId}`).emit('message:receive', message);
    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('SendImage error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const sendVoice = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { duration } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No voice' });
    const chat = await Chat.findById(chatId);
    if (!chat || !chat.participants.includes(req.userId)) return res.status(403).json({ error: 'Access denied' });
    const voiceData = uploadService.saveVoiceMessage(req.file, req.userId, duration);
    const message = new Message({ chatId, sender: req.userId, content: 'Voice message', type: 'voice', mediaUrl: voiceData.url, mediaDuration: voiceData.duration, mediaSize: voiceData.size, deliveredTo: [req.userId] });
    await message.save();
    await message.populate('sender', '-password');
    chat.lastMessage = message._id;
    chat.updatedAt = new Date();
    await chat.save();
    const io = req.app.get('io');
    if (io) io.to(`chat:${chatId}`).emit('message:receive', message);
    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('SendVoice error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const editMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { content } = req.body;
    
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    if (message.sender.toString() !== req.userId) return res.status(403).json({ error: 'Unauthorized to edit this message' });
    
    message.content = content;
    message.edited = true;
    message.editedAt = new Date();
    await message.save();
    
    const io = req.app.get('io');
    if (io) io.to(`chat:${message.chatId}`).emit('message:edited', message);
    
    res.json({ success: true, message });
  } catch (error) {
    console.error('EditMessage error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    
    const chat = await Chat.findById(message.chatId);
    const isAdmin = chat?.isGroup && chat?.admin?.toString() === req.userId;
    const isSender = message.sender.toString() === req.userId;
    
    if (!isSender && !isAdmin) return res.status(403).json({ error: 'Unauthorized to delete this message' });
    
    message.deleted = true;
    message.content = 'This message was deleted';
    await message.save();
    
    const io = req.app.get('io');
    if (io) io.to(`chat:${message.chatId}`).emit('message:deleted', { messageId, chatId: message.chatId });
    
    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    console.error('DeleteMessage error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    await Message.updateMany(
      { chatId, readBy: { $ne: req.userId }, sender: { $ne: req.userId } },
      { $addToSet: { readBy: req.userId } }
    );
    
    const chat = await Chat.findById(chatId);
    if (chat?.unreadCount) {
      chat.unreadCount.set(req.userId.toString(), 0);
      await chat.save();
    }
    
    const io = req.app.get('io');
    if (io) io.to(`chat:${chatId}`).emit('messages:read', { chatId, userId: req.userId });
    
    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    console.error('MarkAsRead error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const chats = await Chat.find({ participants: req.userId });
    let totalUnread = 0;
    chats.forEach(chat => {
      totalUnread += chat.unreadCount?.get(req.userId.toString()) || 0;
    });
    res.json({ success: true, totalUnread });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

const searchMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { q = '' } = req.query;
    const messages = await Message.find({ chatId, content: { $regex: q, $options: 'i' }, deleted: false }).populate('sender', 'username avatar');
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { sendMessage, sendImage, sendVoice, editMessage, deleteMessage, markAsRead, getUnreadCount, searchMessages };