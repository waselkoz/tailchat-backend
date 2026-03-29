const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

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
    const { name, participants = [], avatar, isPublic, description } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Group name required' });
    
    const allParticipants = [req.userId, ...participants];
    const chat = new Chat({ 
      name, 
      participants: allParticipants, 
      isGroup: true, 
      admin: req.userId, 
      avatar: avatar || '',
      isPublic: !!isPublic,
      description: description || ''
    });
    
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
    const token = req.headers.authorization?.split(' ')[1];
    const directDecode = token ? jwt.decode(token) : null;
    console.log('[DEBUG] Direct Token Decode in controller:', directDecode);
    
    // Explicitly fallback to exact token decode to fix the missing req.userId
    const actualUserId = req.userId || (directDecode ? (directDecode.userId || directDecode.id || directDecode._id) : null);
    
    if (!actualUserId) {
      return res.status(401).json({ success: false, error: 'Could not extract user ID from token' });
    }

    const userIdObj = new mongoose.Types.ObjectId(actualUserId);
    
    // Use the $in operator which is safer for array lookups in MongoDB
    const chats = await Chat.find({ participants: { $in: [userIdObj] } })
      .populate('participants', '-password')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    const chatsWithUnread = chats.map(chat => {
      const chatObj = chat.toObject();
      const unreadCount = chat.unreadCount?.get(actualUserId.toString()) || 0;
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
    const { name, avatar, isPublic, description } = req.body;
    const chat = await Chat.findById(id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (chat.isGroup && chat.admin.toString() !== req.userId) return res.status(403).json({ error: 'Admin only' });
    
    if (name) chat.name = name;
    if (avatar) chat.avatar = avatar;
    if (isPublic !== undefined) chat.isPublic = isPublic;
    if (description !== undefined) chat.description = description;

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
    
    // Check if user is a participant
    if (!chat.participants.includes(req.userId)) {
      return res.status(400).json({ error: 'You are not in this group' });
    }

    // Check if user is the admin
    const isAdmin = chat.admin && chat.admin.toString() === req.userId;

    chat.participants = chat.participants.filter(p => p.toString() !== req.userId);
    
    // Assign new admin if needed
    if (isAdmin && chat.participants.length > 0) {
      chat.admin = chat.participants[0];
    }
    
    await chat.save();
    res.json({ success: true, message: 'Left successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// NEW: Discovery and Public Rooms Logic

const getPublicRooms = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = {
      isGroup: true,
      $or: [
        { isPublic: true },
        { 'tailMetadata.visibility': 'public' }
      ]
    };

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const total = await Chat.countDocuments(query);
    const rooms = await Chat.find(query)
      .populate('participants', 'username avatar status')
      .populate('admin', 'username avatar')
      .populate('lastMessage')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const roomsWithDetails = rooms.map(room => {
      const roomObj = room.toObject();
      const isJoined = room.participants.some(p => p._id.toString() === req.userId);
      const participantCount = room.participants.length;
      
      const onlineCount = room.participants.filter(p => 
        global.onlineUsers?.has(p._id.toString())
      ).length;

      return {
        ...roomObj,
        isJoined,
        participantCount,
        onlineCount,
      };
    });

    res.json({
      success: true,
      rooms: roomsWithDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('GetPublicRooms error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getRoomDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await Chat.findOne({ _id: id, isGroup: true })
      .populate('participants', 'username avatar status lastSeen')
      .populate('admin', 'username avatar')
      .populate('lastMessage');

    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isParticipant = room.participants.some(p => p._id.toString() === req.userId);
    const isPublic = room.isPublic || room.tailMetadata?.visibility === 'public';
    
    if (!isParticipant && !isPublic) {
      return res.status(403).json({ error: 'Access denied. This room is private.' });
    }

    const participantsWithStatus = room.participants.map(p => ({
      ...p.toObject(),
      isOnline: global.onlineUsers?.has(p._id.toString()),
    }));

    res.json({
      success: true,
      room: {
        ...room.toObject(),
        participants: participantsWithStatus,
        participantCount: room.participants.length,
        onlineCount: participantsWithStatus.filter(p => p.isOnline).length,
        isParticipant,
      },
    });
  } catch (error) {
    console.error('GetRoomDetails error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const joinPublicRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await Chat.findOne({ _id: id, isGroup: true });

    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isPublic = room.isPublic || room.tailMetadata?.visibility === 'public';
    if (!isPublic) return res.status(403).json({ error: 'This room is private.' });

    if (room.participants.includes(req.userId)) {
      return res.status(400).json({ error: 'Already in this room' });
    }

    room.participants.push(req.userId);
    await room.save();
    await room.populate('participants', 'username avatar status');

    const updatedParticipants = room.participants.map(p => ({
      ...p.toObject(),
      isOnline: global.onlineUsers?.has(p._id.toString()),
    }));

    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${id}`).emit('user:joined', {
        userId: req.userId,
        chatId: id,
        participants: updatedParticipants,
      });
    }

    res.json({ success: true, room: { ...room.toObject(), participants: updatedParticipants } });
  } catch (error) {
    console.error('JoinPublicRoom error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const leavePublicRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await Chat.findOne({ _id: id, isGroup: true });

    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.participants.includes(req.userId)) return res.status(400).json({ error: 'Not in this room' });

    const isAdmin = room.admin && room.admin.toString() === req.userId;

    room.participants = room.participants.filter(p => p.toString() !== req.userId);
    if (isAdmin && room.participants.length > 0) room.admin = room.participants[0];

    await room.save();
    await room.populate('participants', 'username avatar status');

    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${id}`).emit('user:left', {
        userId: req.userId,
        chatId: id,
        participants: room.participants,
      });
    }

    res.json({ success: true, message: 'Left successfully' });
  } catch (error) {
    console.error('LeavePublicRoom error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getRoomParticipants = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await Chat.findById(id).populate('participants', 'username avatar status lastSeen');

    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isParticipant = room.participants.some(p => p._id.toString() === req.userId);
    const isPublic = room.isPublic || room.tailMetadata?.visibility === 'public';

    if (!isParticipant && !isPublic) return res.status(403).json({ error: 'Access denied' });

    const participantsWithStatus = room.participants.map(p => ({
      ...p.toObject(),
      isOnline: global.onlineUsers?.has(p._id.toString()),
    }));

    res.json({
      success: true,
      participants: participantsWithStatus,
      totalCount: participantsWithStatus.length,
      onlineCount: participantsWithStatus.filter(p => p.isOnline).length,
    });
  } catch (error) {
    console.error('GetRoomParticipants error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getUserProfileRooms = async (req, res) => {
  try {
    const { id: userId } = req.params;
    const isOwnProfile = req.userId === userId;

    const query = { participants: userId, isGroup: true };
    
    // If not their own profile, only show public rooms
    if (!isOwnProfile) {
      query.$or = [
        { isPublic: true },
        { 'tailMetadata.visibility': 'public' }
      ];
    }

    const rooms = await Chat.find(query)
      .populate('participants', 'username avatar status')
      .populate('admin', 'username avatar')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    const roomsWithDetails = rooms.map(room => {
      const roomObj = room.toObject();
      const isJoined = room.participants.some(p => p._id && p._id.toString() === req.userId);
      const participantCount = room.participants.length;
      
      const onlineCount = room.participants.filter(p => 
        global.onlineUsers?.has(p._id && p._id.toString())
      ).length;

      return {
        ...roomObj,
        isJoined,
        participantCount,
        onlineCount,
      };
    });

    res.json({ success: true, rooms: roomsWithDetails });
  } catch (error) {
    console.error('GetUserProfileRooms error:', error);
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
  getPublicRooms,
  getRoomDetails,
  joinPublicRoom,
  leavePublicRoom,
  getRoomParticipants,
  getUserProfileRooms,
};