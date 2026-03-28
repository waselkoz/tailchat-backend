const express = require('express');
const {
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead,
} = require('../controllers/messageController');
const authMiddleware = require('../middleware/auth');
const { messageLimiter } = require('../middleware/rateLimiter');
const { validateId, validateMessage } = require('../middleware/validation');

const router = express.Router();

router.use(authMiddleware);

router.post('/read', markAsRead);

router.post('/:chatId', validateId, messageLimiter, validateMessage, sendMessage);

router.patch('/:id', validateId, editMessage);

router.delete('/:id', validateId, deleteMessage);

module.exports = router;