const jwt = require('jsonwebtoken');
const config = require('../config/env');
const authMiddleware = async (req, res, next) => {
  const publicPaths = ['/api/auth/login', '/api/auth/register', '/health', '/'];
  if (publicPaths.includes(req.path)) return next();
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    const code = error.name === 'JsonWebTokenError' ? 'INVALID_TOKEN' : 
                 error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'AUTH_FAILED';
    return res.status(403).json({ error: error.message, code });
  }
};
module.exports = authMiddleware;