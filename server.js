const app = require('./src/app');
const http = require('http');
const { connectDB } = require('./src/config/database');
const { initializeSocket } = require('./src/socket/socketHandler');
require('dotenv').config();
const server = http.createServer(app);
connectDB();
const io = initializeSocket(server);
app.set('io', io);
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);
});
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`WebSocket: ws://localhost:${PORT}/socket.io`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});