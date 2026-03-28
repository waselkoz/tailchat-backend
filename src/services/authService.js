const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const emailService = require('./emailService');

class AuthService {
  async register(username, email, password) {
    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Create user
    const user = new User({ username, email, password });
    await user.save();

    // Send welcome email
    await emailService.sendWelcomeEmail(email, username);

    // Generate token
    const token = generateToken(user._id);

    return { user, token };
  }

  async login(email, password) {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Update status
    user.status = 'online';
    user.lastSeen = new Date();
    await user.save();

    const token = generateToken(user._id);

    return { user, token };
  }

  async logout(userId) {
    await User.findByIdAndUpdate(userId, {
      status: 'offline',
      lastSeen: new Date(),
    });
    return { success: true };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');
    
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    return { success: true };
  }

  async requestPasswordReset(email) {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('User not found');
    }

    // Generate reset token
    const resetToken = generateToken(user._id);
    
    // Send reset email
    await emailService.sendPasswordResetEmail(email, resetToken);

    return { success: true };
  }
}

module.exports = new AuthService();