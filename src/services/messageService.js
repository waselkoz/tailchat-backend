const Message = require('../models/Message');
const Chat = require('../models/Chat');
const uploadService = require('./uploadService');

class MessageService {
  async createMessage(chatId, senderId, content, type = 'text', replyTo = null) {
    const message = new Message({
      chatId,
      sender: senderId,
      content,
      type,
      replyTo,
      deliveredTo: [senderId],
    });

    await message.save();
    await message.populate('sender', '-password');
    
    // Update chat
    const chat = await Chat.findById(chatId);
    chat.lastMessage = message._id;
    chat.updatedAt = new Date();
    
    // Increment unread count
    chat.participants.forEach(participantId => {
      if (participantId.toString() !== senderId) {
        const current = chat.unreadCount?.get(participantId.toString()) || 0;
        chat.unreadCount.set(participantId.toString(), current + 1);
      }
    });
    
    await chat.save();

    return message;
  }

  async createImageMessage(chatId, senderId, file) {
    const imageUrl = uploadService.saveImage(file, senderId);
    
    return this.createMessage(chatId, senderId, '📷 Image', 'image', null, {
      mediaUrl: imageUrl,
      mediaSize: file.size,
    });
  }

  async createVoiceMessage(chatId, senderId, file, duration) {
    const voiceData = uploadService.saveVoiceMessage(file, senderId, duration);
    
    const message = new Message({
      chatId,
      sender: senderId,
      content: '🎤 Voice message',
      type: 'voice',
      mediaUrl: voiceData.url,
      mediaDuration: voiceData.duration,
      mediaSize: voiceData.size,
      deliveredTo: [senderId],
    });

    await message.save();
    await message.populate('sender', '-password');
    
    // Update chat
    const chat = await Chat.findById(chatId);
    chat.lastMessage = message._id;
    chat.updatedAt = new Date();
    await chat.save();

    return message;
  }

  async editMessage(messageId, userId, newContent) {
    const message = await Message.findById(messageId);
    
    if (message.sender.toString() !== userId) {
      throw new Error('You can only edit your own messages');
    }
    
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (message.createdAt < fiveMinutesAgo) {
      throw new Error('Messages can only be edited within 5 minutes');
    }
    
    message.content = newContent;
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    return message;
  }

  async deleteMessage(messageId, userId) {
    const message = await Message.findById(messageId);
    const chat = await Chat.findById(message.chatId);
    
    const isAdmin = chat.isGroup && chat.admin.toString() === userId;
    const isSender = message.sender.toString() === userId;
    
    if (!isSender && !isAdmin) {
      throw new Error('You cannot delete this message');
    }
    
    message.deleted = true;
    message.content = 'This message was deleted';
    await message.save();
    
    return { success: true };
  }

  async markAsRead(chatId, userId) {
    await Message.updateMany(
      { chatId, readBy: { $ne: userId }, sender: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );
    
    const chat = await Chat.findById(chatId);
    if (chat?.unreadCount) {
      chat.unreadCount.set(userId.toString(), 0);
      await chat.save();
    }
    
    return { success: true };
  }
}

module.exports = new MessageService();