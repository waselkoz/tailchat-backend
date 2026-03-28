const express = require('express');
const multer = require('multer');
const {
  getAllUsers,
  searchUsers,
  getUserById,
  updateStatus,
  updateProfile,
  updateFullProfile,
  getProfileStats,
  getUserTails,
  uploadAvatar,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
} = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validateId } = require('../middleware/validation');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });


router.use(authMiddleware);


router.get('/', apiLimiter, getAllUsers);
router.get('/search', apiLimiter, searchUsers);
router.patch('/status', updateStatus);
router.patch('/profile', updateFullProfile); 
router.post('/avatar', upload.single('avatar'), uploadAvatar);


router.get('/:id', validateId, getUserById);
router.get('/:id/stats', validateId, getProfileStats);
router.get('/:id/tails', validateId, getUserTails);


router.post('/:id/follow', validateId, followUser);
router.delete('/:id/follow', validateId, unfollowUser);
router.get('/:id/followers', validateId, getFollowers);
router.get('/:id/following', validateId, getFollowing);

module.exports = router;