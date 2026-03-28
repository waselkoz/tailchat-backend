const dotenv = require('dotenv');
dotenv.config();
const config = {
  PORT: process.env.PORT || 8080,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000', 
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET || 'tailchat-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  SOCKET_PATH: process.env.SOCKET_PATH || '/socket.io',
};
const validateConfig = () => {
  const required = ['JWT_SECRET'];
  const missing = required.filter(key => !config[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};
validateConfig();
module.exports = config;