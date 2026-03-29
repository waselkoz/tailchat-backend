const express = require('express');
const {
  getOrCreatePrivateChat,
  createGroupChat,
  getUserChats,
  getChatById,
  getChatMessages,
  updateGroupChat,
  addParticipants,
  getPublicRooms,
  getRoomDetails,
  joinPublicRoom,
  leavePublicRoom,
  getRoomParticipants,
  getUserProfileRooms,
} = require('../controllers/chatController');
const authMiddleware = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { validateId, validateGroupChat } = require('../middleware/validation');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// User Profile Rooms
router.get('/user/:id/rooms', validateId, getUserProfileRooms);

// Discovery and Public Rooms (placed above /:id to prevent route collision)
router.get('/rooms/public', getPublicRooms);
router.get('/rooms/:id', validateId, getRoomDetails);
router.get('/rooms/:id/participants', validateId, getRoomParticipants);
router.post('/rooms/:id/join', validateId, joinPublicRoom);
router.post('/rooms/:id/leave', validateId, leavePublicRoom);

// Base Chat Routes
router.get('/', apiLimiter, getUserChats);
router.post('/private', apiLimiter, getOrCreatePrivateChat);
router.post('/group', apiLimiter, validateGroupChat, createGroupChat);
router.get('/:id', validateId, getChatById);
router.get('/:id/messages', validateId, apiLimiter, getChatMessages);
router.patch('/:id', validateId, updateGroupChat);
router.post('/:id/participants', validateId, addParticipants);

module.exports = router;