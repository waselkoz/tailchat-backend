const User = require('../models/User');
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).select('-password').sort({ username: 1 });
    res.json({ success: true, users });
  } catch (error) {
    console.error('GetAllUsers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, users: [] });
    const users = await User.find({ _id: { $ne: req.userId }, username: { $regex: q, $options: 'i' } }).select('-password').limit(20);
    res.json({ success: true, users });
  } catch (error) {
    console.error('SearchUsers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    console.error('GetUserById error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['online', 'offline', 'away', 'busy'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const user = await User.findByIdAndUpdate(req.userId, { status, lastSeen: new Date() }, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    console.error('UpdateStatus error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const updateProfile = async (req, res) => {
  try {
    const { username, avatar } = req.body;
    const updates = {};
    if (username) updates.username = username;
    if (avatar) updates.avatar = avatar;
    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true, runValidators: true }).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    console.error('UpdateProfile error:', error);
    if (error.code === 11000) return res.status(400).json({ error: 'Username taken' });
    res.status(500).json({ error: 'Server error' });
  }
};
const deleteAccount = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.userId);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.userId).select('+password');
    if (!(await user.comparePassword(currentPassword))) return res.status(400).json({ error: 'Wrong password' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Changed' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
const followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.userId) return res.status(400).json({ error: 'Cannot follow self' });
    const userToFollow = await User.findById(userId);
    if (!userToFollow) return res.status(404).json({ error: 'User not found' });
    const currentUser = await User.findById(req.userId);
    if (currentUser.following.includes(userId)) return res.status(400).json({ error: 'Already following' });
    await currentUser.follow(userId);
    await User.findByIdAndUpdate(userId, { $addToSet: { followers: req.userId } });
    res.json({ success: true, following: currentUser.following });
  } catch (error) {
    console.error('FollowUser error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = await User.findById(req.userId);
    if (!currentUser.following.includes(userId)) return res.status(400).json({ error: 'Not following' });
    await currentUser.unfollow(userId);
    await User.findByIdAndUpdate(userId, { $pull: { followers: req.userId } });
    res.json({ success: true, following: currentUser.following });
  } catch (error) {
    console.error('UnfollowUser error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).populate('followers', '-password');
    res.json({ success: true, followers: user.followers });
  } catch (error) {
    console.error('GetFollowers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).populate('following', '-password');
    res.json({ success: true, following: user.following });
  } catch (error) {
    console.error('GetFollowing error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const updateFullProfile = async (req, res) => {
  try {
    const { username, avatar, bio, location } = req.body;
    const updates = {};
    if (username) updates.username = username;
    if (avatar) updates.avatar = avatar;
    if (bio !== undefined) updates.bio = bio;
    if (location !== undefined) updates.location = location;
    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true, runValidators: true }).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    console.error('UpdateFullProfile error:', error);
    if (error.code === 11000) return res.status(400).json({ error: 'Username taken' });
    res.status(500).json({ error: 'Server error' });
  }
};
const getProfileStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const tailCount = await require('../models/Message').countDocuments({ sender: userId, isTail: true, deleted: false });
    res.json({ success: true, stats: { followersCount: user.followers.length, followingCount: user.following.length, tailsCount: tailCount, joinedDate: user.createdAt } });
  } catch (error) {
    console.error('GetProfileStats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const getUserTails = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, before } = req.query;
    const query = { sender: userId, isTail: true, deleted: false };
    if (before) query.createdAt = { $lt: new Date(before) };
    const tails = await require('../models/Message').find(query).populate('sender', '-password').populate('reactions.user', '-password').populate('comments.user', '-password').sort({ createdAt: -1 }).limit(parseInt(limit));
    res.json({ success: true, tails });
  } catch (error) {
    console.error('GetUserTails error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image' });
    const avatarUrl = require('../services/uploadService').saveImage(req.file, req.userId);
    const user = await User.findByIdAndUpdate(req.userId, { avatar: avatarUrl }, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    console.error('UploadAvatar error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
module.exports = { getAllUsers, searchUsers, getUserById, updateStatus, updateProfile, deleteAccount, changePassword, followUser, unfollowUser, getFollowers, getFollowing, updateFullProfile, getProfileStats, getUserTails, uploadAvatar };