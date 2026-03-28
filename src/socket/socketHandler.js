const { Server } = require('socket.io');
const { socketConfig } = require('../config/socket');
const { verifyToken } = require('../utils/jwt');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');
const onlineUsers = new Map();
const initializeSocket = (server) => {
  const io = new Server(server, socketConfig);
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication error: no token'));
    try {
      const decoded = verifyToken(token);
      socket.userId = decoded.userId || decoded.id;
      next();
    } catch (err) {
      return next(new Error('Authentication error: invalid token'));
    }
  });
  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`Socket connected: ${socket.id} (user: ${userId})`);
    onlineUsers.set(userId, socket.id);
    try {
      await User.findByIdAndUpdate(userId, { status: 'online', lastSeen: new Date() });
    } catch (error) {
      console.error('Error updating user status:', error);
    }
    socket.broadcast.emit('user:online', { userId });
    socket.join(`user:${userId}`);
    try {
      const userChats = await Chat.find({ participants: userId });
      userChats.forEach(chat => socket.join(`chat:${chat._id}`));
    } catch (error) {
      console.error('Error auto-joining chats:', error);
    }
    socket.on('chat:join', (chatId) => {
      socket.join(`chat:${chatId}`);
    });
    socket.on('chat:leave', (chatId) => {
      socket.leave(`chat:${chatId}`);
    });
    socket.on('message:send', async (data, callback) => {
      try {
        const { chatId, content, type = 'text', replyTo } = data;
        if (!content || !content.trim()) return callback?.({ error: 'Message content is required' });
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(userId)) return callback?.({ error: 'Access denied' });
        const message = new Message({ chatId, sender: userId, content: content.trim(), type, replyTo: replyTo || null, deliveredTo: [userId] });
        await message.save();
        await message.populate('sender', '-password');
        if (replyTo) await message.populate('replyTo');
        chat.lastMessage = message._id;
        chat.updatedAt = new Date();
        chat.participants.forEach((participantId) => {
          if (participantId.toString() !== userId) {
            const current = chat.unreadCount?.get(participantId.toString()) || 0;
            if (!chat.unreadCount) chat.unreadCount = new Map();
            chat.unreadCount.set(participantId.toString(), current + 1);
          }
        });
        await chat.save();
        io.to(`chat:${chatId}`).emit('message:receive', message);
        chat.participants.forEach((participantId) => {
          if (participantId.toString() !== userId) {
            io.to(`user:${participantId}`).emit('message:new', { message, chat: { _id: chat._id, name: chat.name, isGroup: chat.isGroup } });
          }
        });
        callback?.({ success: true, message });
      } catch (err) {
        console.error('Socket message:send error:', err);
        callback?.({ error: 'Failed to send message' });
      }
    });
    socket.on('typing:start', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('typing:start', { userId, chatId });
    });
    socket.on('typing:stop', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('typing:stop', { userId, chatId });
    });
    socket.on('messages:read', async ({ chatId }) => {
      try {
        await Message.updateMany({ chatId, readBy: { $ne: userId }, sender: { $ne: userId } }, { $addToSet: { readBy: userId } });
        const chat = await Chat.findById(chatId);
        if (chat?.unreadCount) {
          chat.unreadCount.set(userId.toString(), 0);
          await chat.save();
        }
        io.to(`chat:${chatId}`).emit('messages:read', { chatId, userId });
      } catch (err) {
        console.error('Socket messages:read error:', err);
      }
    });
    socket.on('message:edit', async ({ messageId, content }, callback) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return callback?.({ error: 'Message not found' });
        if (message.sender.toString() !== userId) return callback?.({ error: 'Unauthorized' });
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (message.createdAt < fiveMinutesAgo) return callback?.({ error: 'Expired' });
        message.content = content;
        message.edited = true;
        message.editedAt = new Date();
        await message.save();
        io.to(`chat:${message.chatId}`).emit('message:edited', message);
        callback?.({ success: true, message });
      } catch (err) {
        console.error('Socket message:edit error:', err);
        callback?.({ error: 'Failed to edit message' });
      }
    });
    socket.on('message:delete', async ({ messageId }, callback) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return callback?.({ error: 'Message not found' });
        const chat = await Chat.findById(message.chatId);
        const isAdmin = chat.isGroup && chat.admin.toString() === userId;
        const isSender = message.sender.toString() === userId;
        if (!isSender && !isAdmin) return callback?.({ error: 'Unauthorized' });
        message.deleted = true;
        message.content = 'This message was deleted';
        await message.save();
        io.to(`chat:${message.chatId}`).emit('message:deleted', { messageId, chatId: message.chatId });
        callback?.({ success: true });
      } catch (err) {
        console.error('Socket message:delete error:', err);
        callback?.({ error: 'Failed to delete message' });
      }
    });
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id} (user: ${userId})`);
      onlineUsers.delete(userId);
      try {
        await User.findByIdAndUpdate(userId, { status: 'offline', lastSeen: new Date() });
        io.emit('user:offline', { userId });
      } catch (err) {
        console.error('Disconnect update error:', err);
      }
    });
  });
  return io;
};
module.exports = { initializeSocket, onlineUsers };