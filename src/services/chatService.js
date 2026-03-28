const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');

class ChatService {
  async getOrCreatePrivateChat(userId1, userId2) {
    let chat = await Chat.findOne({
      isGroup: false,
      participants: { $all: [userId1, userId2], $size: 2 },
    }).populate('participants', '-password');

    if (!chat) {
      chat = new Chat({
        participants: [userId1, userId2],
        isGroup: false,
      });
      await chat.save();
      await chat.populate('participants', '-password');
    }

    return chat;
  }

  async createGroupChat(name, adminId, participants, avatar = '') {
    const chat = new Chat({
      name,
      participants: [adminId, ...participants],
      isGroup: true,
      admin: adminId,
      avatar,
    });

    await chat.save();
    await chat.populate('participants', '-password');

    return chat;
  }

  async addParticipants(chatId, userIds, adminId) {
    const chat = await Chat.findById(chatId);
    
    if (chat.admin.toString() !== adminId) {
      throw new Error('Only admin can add participants');
    }

    const newParticipants = userIds.filter(
      uid => !chat.participants.includes(uid)
    );
    
    chat.participants.push(...newParticipants);
    await chat.save();
    await chat.populate('participants', '-password');

    return chat;
  }

  async removeParticipant(chatId, userId, adminId) {
    const chat = await Chat.findById(chatId);
    
    if (chat.admin.toString() !== adminId) {
      throw new Error('Only admin can remove participants');
    }

    chat.participants = chat.participants.filter(
      p => p.toString() !== userId
    );
    await chat.save();

    return chat;
  }

  async leaveGroup(chatId, userId) {
    const chat = await Chat.findById(chatId);
    
    chat.participants = chat.participants.filter(
      p => p.toString() !== userId
    );
    
   
    if (chat.admin.toString() === userId && chat.participants.length > 0) {
      chat.admin = chat.participants[0];
    }
    
    await chat.save();
    return chat;
  }
}

module.exports = new ChatService();