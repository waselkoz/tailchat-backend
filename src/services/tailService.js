const Message = require('../models/Message');
const User = require('../models/User');

class TailService {
  async createTail(userId, content, title, tags, visibility = 'public', mediaUrl = null) {
    const tail = new Message({
      chatId: null,
      sender: userId,
      content,
      type: 'tail',
      isTail: true,
      mediaUrl: mediaUrl || null,
      tailMetadata: {
        title: title || '',
        tags: tags || [],
        visibility,
      },
    });

    await tail.save();
    await tail.populate('sender', '-password');

    return tail;
  }

  async getFeed(userId, limit = 20, before = null) {
    const user = await User.findById(userId);
    
    const query = { isTail: true, deleted: false };
    
    // Filter by visibility
    query.$or = [
      { 'tailMetadata.visibility': 'public' },
      { sender: userId },
      { 
        'tailMetadata.visibility': 'followers', 
        sender: { $in: user.following || [] } 
      },
    ];
    
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }
    
    const tails = await Message.find(query)
      .populate('sender', '-password')
      .populate('reactions.user', '-password')
      .populate('comments.user', '-password')
      .sort({ createdAt: -1 })
      .limit(limit);

    return tails;
  }

  async addReaction(tailId, userId, emoji) {
    const tail = await Message.findById(tailId);
    
    if (!tail || !tail.isTail) {
      throw new Error('Tail not found');
    }
    
    const existingReaction = tail.reactions.find(
      r => r.user.toString() === userId
    );
    
    if (existingReaction) {
      if (existingReaction.emoji === emoji) {
        tail.reactions = tail.reactions.filter(r => r.user.toString() !== userId);
      } else {
        existingReaction.emoji = emoji;
      }
    } else {
      tail.reactions.push({ user: userId, emoji });
    }
    
    await tail.save();
    await tail.populate('reactions.user', '-password');
    
    return tail.reactions;
  }

  async addComment(tailId, userId, content) {
    const tail = await Message.findById(tailId);
    
    if (!tail || !tail.isTail) {
      throw new Error('Tail not found');
    }
    
    const comment = {
      user: userId,
      content: content.trim(),
      createdAt: new Date(),
    };
    
    tail.comments.push(comment);
    await tail.save();
    await tail.populate('comments.user', '-password');
    
    return tail.comments;
  }

  async deleteComment(tailId, commentId, userId) {
    const tail = await Message.findById(tailId);
    
    const comment = tail.comments.id(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }
    
    if (comment.user.toString() !== userId && tail.sender.toString() !== userId) {
      throw new Error('Not authorized');
    }
    
    comment.remove();
    await tail.save();
    
    return { success: true };
  }
}

module.exports = new TailService();