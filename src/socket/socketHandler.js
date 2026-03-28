const { Server } = require('socket.io');
const { socketConfig } = require('../config/socket');
const { verifyToken } = require('../utils/jwt');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/User');

const onlineUsers = new Map(); // userId -> socketId
const roomUsers = new Map();   // roomId -> Set of userIds
const userRooms = new Map();   // userId -> Set of roomIds

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
    
    // Update user status
    try {
      await User.findByIdAndUpdate(userId, { status: 'online', lastSeen: new Date() });
      socket.broadcast.emit('user:online', { userId });
    } catch (error) {
      console.error('Error updating user status:', error);
    }

    // Auto-join existing chats
    socket.join(`user:${userId}`);
    try {
      const userChats = await Chat.find({ participants: userId });
      userChats.forEach(chat => socket.join(`chat:${chat._id}`));
    } catch (error) {
      console.error('Error auto-joining chats:', error);
    }

    // --- Chat Room Management Handlers ---

    socket.on('chat:join', (chatId) => {
      socket.join(`chat:${chatId}`);
      
      // Track users in room
      if (!roomUsers.has(chatId)) {
        roomUsers.set(chatId, new Set());
      }
      roomUsers.get(chatId).add(userId);
      
      // Track rooms for user
      if (!userRooms.has(userId)) {
        userRooms.set(userId, new Set());
      }
      userRooms.get(userId).add(chatId);
      
      // Broadcast updated user list to room
      const usersInRoom = Array.from(roomUsers.get(chatId));
      io.to(`chat:${chatId}`).emit('room:users:update', {
        chatId,
        users: usersInRoom,
        count: usersInRoom.length,
      });
      
      console.log(`User ${userId} joined chat:${chatId}`);
    });

    socket.on('chat:leave', (chatId) => {
      socket.leave(`chat:${chatId}`);
      
      if (roomUsers.has(chatId)) {
        roomUsers.get(chatId).delete(userId);
        const usersInRoom = Array.from(roomUsers.get(chatId));
        io.to(`chat:${chatId}`).emit('room:users:update', {
          chatId,
          users: usersInRoom,
          count: usersInRoom.length,
        });
        if (roomUsers.get(chatId).size === 0) roomUsers.delete(chatId);
      }
      
      if (userRooms.has(userId)) {
        userRooms.get(userId).delete(chatId);
        if (userRooms.get(userId).size === 0) userRooms.delete(userId);
      }
      
      console.log(`User ${userId} left chat:${chatId}`);
    });

    socket.on('room:getUsers', (chatId, callback) => {
      const users = roomUsers.has(chatId) ? Array.from(roomUsers.get(chatId)) : [];
      callback({ users, count: users.length });
    });

    // --- Message Handlers ---

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
            if (!chat.unreadCount) chat.unreadCount = new Map();
            const current = chat.unreadCount.get(participantId.toString()) || 0;
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

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id} (user: ${userId})`);
      onlineUsers.delete(userId);
      
      // Clean up room tracking
      if (userRooms.has(userId)) {
        for (const roomId of userRooms.get(userId)) {
          if (roomUsers.has(roomId)) {
            roomUsers.get(roomId).delete(userId);
            const usersInRoom = Array.from(roomUsers.get(roomId));
            io.to(`chat:${roomId}`).emit('room:users:update', {
              chatId: roomId,
              users: usersInRoom,
              count: usersInRoom.length,
            });
            if (roomUsers.get(roomId).size === 0) roomUsers.delete(roomId);
          }
        }
        userRooms.delete(userId);
      }

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

module.exports = { initializeSocket, onlineUsers, roomUsers, userRooms };