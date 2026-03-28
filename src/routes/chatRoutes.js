const express = require('express');
const {
  getOrCreatePrivateChat,
  createGroupChat,
  getUserChats,
  getChatById,
  getChatMessages,
  updateGroupChat,
  addParticipants,
} = require('../controllers/chatController');
const authMiddleware = require('../middleware/auth');
const { apiLimiter, messageLimiter } = require('../middleware/rateLimiter');
const { validateId, validateGroupChat } = require('../middleware/validation');

const router = express.Router();

router.use(authMiddleware);

router.get('/', apiLimiter, getUserChats);

router.post('/private', apiLimiter, getOrCreatePrivateChat);

router.post('/group', apiLimiter, validateGroupChat, createGroupChat);

router.get('/:id', validateId, getChatById);

router.get('/:id/messages', validateId, apiLimiter, getChatMessages);

router.patch('/:id', validateId, updateGroupChat);

router.post('/:id/participants', validateId, addParticipants);

module.exports = router;