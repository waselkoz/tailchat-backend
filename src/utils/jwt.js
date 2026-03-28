const jwt = require('jsonwebtoken');
const config = require('../config/env');

const generateToken = (userId) => {
  return jwt.sign(
    { userId, id: userId }, // Include both for compatibility
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
};

const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = { generateToken, verifyToken, decodeToken };