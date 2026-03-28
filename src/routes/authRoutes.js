const express = require('express');
const { register, login, getMe, logout } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { validateRegister, validateLogin } = require('../middleware/validation');

const router = express.Router();

router.post('/register', authLimiter, validateRegister, register);

router.post('/login', authLimiter, validateLogin, login);

router.get('/me', authMiddleware, getMe);

router.post('/logout', authMiddleware, logout);

module.exports = router;