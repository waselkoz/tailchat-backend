const config = require('./env');
const socketConfig = {
  cors: {
    origin: config.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
};
const getSocketConfig = () => {
  return socketConfig;
};
module.exports = { getSocketConfig, socketConfig };