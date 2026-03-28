const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,
  },
  avatar: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'away', 'busy'],
    default: 'offline',
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
  // Social features
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  bio: {
    type: String,
    maxlength: [160, 'Bio cannot exceed 160 characters'],
    default: '',
  },
  location: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});


UserSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};
UserSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};


UserSchema.methods.updateLastSeen = async function() {
  this.lastSeen = new Date();
  await this.save();
};


UserSchema.methods.follow = async function(userId) {
  if (!this.following.includes(userId)) {
    this.following.push(userId);
    await this.save();
  }
};

UserSchema.methods.unfollow = async function(userId) {
  this.following = this.following.filter(id => id.toString() !== userId.toString());
  await this.save();
};

UserSchema.methods.isFollowing = function(userId) {
  return this.following.includes(userId);
};

module.exports = mongoose.model('User', UserSchema);