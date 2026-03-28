const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Too many requests', message: 'Please try again later', code: 'RATE_LIMIT_EXCEEDED' }, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: 'Too many login attempts', message: 'Please try again later', code: 'AUTH_RATE_LIMIT' }, skipSuccessfulRequests: true });
const messageLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Too many messages', message: 'Please slow down', code: 'MESSAGE_RATE_LIMIT' } });
const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { error: 'Too many uploads', message: 'Upload limit reached', code: 'UPLOAD_RATE_LIMIT' } });
module.exports = { apiLimiter, authLimiter, messageLimiter, uploadLimiter };