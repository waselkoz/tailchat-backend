const fs = require('fs');
const path = require('path');

/**
 * Initializes the upload directories to ensure they exist on server startup.
 */
const initializeDirectories = () => {
  const uploadDirs = [
    'uploads',
    'uploads/avatars',
    'uploads/images',
    'uploads/videos',
    'uploads/files',
    'uploads/voice',
    'uploads/misc',
  ];

  uploadDirs.forEach((dir) => {
    const dirPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(dirPath)) {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`[DirManager] Created directory: ${dir}`);
      } catch (error) {
        console.error(`[DirManager] Error creating directory ${dir}:`, error);
      }
    }
  });
};

module.exports = { initializeDirectories };
