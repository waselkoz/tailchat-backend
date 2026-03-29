const express = require('express');
const multer = require('multer');
const {
  sendMessage,
  sendImage,
  sendVoice,
  editMessage,
  deleteMessage,
  markAsRead,
} = require('../controllers/messageController');
const authMiddleware = require('../middleware/auth');
const { messageLimiter } = require('../middleware/rateLimiter');
const { validateId, validateMessage } = require('../middleware/validation');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authMiddleware);

router.post('/read', markAsRead);

// Standard text message
router.post('/:chatId', validateId, messageLimiter, validateMessage, sendMessage);

// Media uploads
router.post('/:chatId/image', validateId, messageLimiter, upload.single('file'), sendImage);
router.post('/:chatId/voice', validateId, messageLimiter, upload.single('file'), sendVoice);
router.post('/:chatId/file', validateId, messageLimiter, upload.single('file'), sendImage); // fallback to sendImage for generic files for now

router.patch('/:id', validateId, editMessage);

router.delete('/:id', validateId, deleteMessage);

module.exports = router;