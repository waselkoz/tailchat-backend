const Message = require('../models/Message');
const User = require('../models/User');
const createTail = async (req, res) => {
  try {
    const { content, title, tags, visibility = 'public', mediaUrl } = req.body;
    const tail = new Message({ chatId: null, sender: req.userId, content, type: 'tail', isTail: true, mediaUrl: mediaUrl || null, tailMetadata: { title: title || '', tags: tags || [], visibility } });
    await tail.save();
    await tail.populate('sender', '-password');
    const io = req.app.get('io');
    if (io) io.emit('tail:new', tail);
    res.status(201).json({ success: true, tail });
  } catch (error) {
    console.error('CreateTail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const getFeed = async (req, res) => {
  try {
    const { limit = 20, before } = req.query;
    const user = await User.findById(req.userId);
    const query = { isTail: true, deleted: false };
    query.$or = [{ 'tailMetadata.visibility': 'public' }, { sender: req.userId }, { 'tailMetadata.visibility': 'followers', sender: { $in: user.following || [] } }];
    if (before) query.createdAt = { $lt: new Date(before) };
    const tails = await Message.find(query).populate('sender', '-password').populate('reactions.user', '-password').populate('comments.user', '-password').sort({ createdAt: -1 }).limit(parseInt(limit));
    res.json({ success: true, tails });
  } catch (error) {
    console.error('GetFeed error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const getTail = async (req, res) => {
  try {
    const { id } = req.params;
    const tail = await Message.findOne({ _id: id, isTail: true, deleted: false }).populate('sender', '-password').populate('reactions.user', '-password').populate('comments.user', '-password');
    if (!tail) return res.status(404).json({ error: 'Tail not found' });
    res.json({ success: true, tail });
  } catch (error) {
    console.error('GetTail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const reactToTail = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const tail = await Message.findById(id);
    if (!tail || !tail.isTail) return res.status(404).json({ error: 'Tail not found' });
    const existingReaction = tail.reactions.find(r => r.user.toString() === req.userId);
    if (existingReaction) {
      if (existingReaction.emoji === emoji) {
        tail.reactions = tail.reactions.filter(r => r.user.toString() !== req.userId);
      } else {
        existingReaction.emoji = emoji;
      }
    } else {
      tail.reactions.push({ user: req.userId, emoji });
    }
    await tail.save();
    await tail.populate('reactions.user', '-password');
    const io = req.app.get('io');
    if (io) io.emit('tail:reacted', { tailId: id, reactions: tail.reactions });
    res.json({ success: true, reactions: tail.reactions });
  } catch (error) {
    console.error('ReactToTail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const commentOnTail = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    if (!content || content.trim() === '') return res.status(400).json({ error: 'Comment required' });
    const tail = await Message.findById(id);
    if (!tail || !tail.isTail) return res.status(404).json({ error: 'Tail not found' });
    const comment = { user: req.userId, content: content.trim(), createdAt: new Date() };
    tail.comments.push(comment);
    await tail.save();
    await tail.populate('comments.user', '-password');
    const io = req.app.get('io');
    if (io) io.emit('tail:commented', { tailId: id, comments: tail.comments });
    res.status(201).json({ success: true, comments: tail.comments });
  } catch (error) {
    console.error('CommentOnTail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const deleteComment = async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const tail = await Message.findById(id);
    if (!tail || !tail.isTail) return res.status(404).json({ error: 'Tail not found' });
    
    const comment = tail.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });
    
    // Authorization check: User must be comment owner or tail owner
    if (comment.user.toString() !== req.userId && tail.sender.toString() !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this comment' });
    }

    tail.comments.pull(commentId);
    await tail.save();
    
    const io = req.app.get('io');
    if (io) io.emit('tail:commentDeleted', { tailId: id, commentId });
    
    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    console.error('DeleteComment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
module.exports = { createTail, getFeed, getTail, reactToTail, commentOnTail, deleteComment };