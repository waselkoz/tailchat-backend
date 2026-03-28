const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { validateEmail, validateUsername, validatePassword } = require('../utils/validators');
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email' });
    if (!validateUsername(username)) return res.status(400).json({ error: 'Invalid username' });
    if (!validatePassword(password)) return res.status(400).json({ error: 'Invalid password' });
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) return res.status(400).json({ error: 'User exists' });
    const user = new User({ username, email, password });
    await user.save();
    const token = generateToken(user._id);
    res.status(201).json({ success: true, token, user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    user.status = 'online';
    user.lastSeen = new Date();
    await user.save();
    const token = generateToken(user._id);
    res.json({ success: true, token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, user });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, { status: 'offline', lastSeen: new Date() });
    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
module.exports = { register, login, getMe, logout };