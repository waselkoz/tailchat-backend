const express = require('express');
const multer = require('multer');
const {
  createTail,
  getFeed,
  getTail,
  reactToTail,
  commentOnTail,
  deleteComment,
} = require('../controllers/tailController');
const authMiddleware = require('../middleware/auth');
const { messageLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });


router.use(authMiddleware);


router.get('/feed', getFeed);
router.post('/tail', messageLimiter, upload.single('media'), createTail);
router.get('/tail/:id', getTail);


router.post('/tail/:id/react', reactToTail);
router.post('/tail/:id/comment', commentOnTail);
router.delete('/tail/:id/comment/:commentId', deleteComment);

module.exports = router;