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
const editMessage = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const deleteMessage = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const markAsRead = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const getUnreadCount = async (req, res) => res.status(501).json({ error: 'Not implemented' });
const searchMessages = async (req, res) => res.status(501).json({ error: 'Not implemented' });
module.exports = { sendMessage, sendImage, sendVoice, editMessage, deleteMessage, markAsRead, getUnreadCount, searchMessages };