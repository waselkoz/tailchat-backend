const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Ensure upload directories exist
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

class UploadService {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../uploads');
    this.imagesDir = path.join(this.uploadDir, 'images');
    this.voiceDir = path.join(this.uploadDir, 'voice');
    this.videosDir = path.join(this.uploadDir, 'videos');
    
    // Create directories
    ensureDirectoryExists(this.imagesDir);
    ensureDirectoryExists(this.voiceDir);
    ensureDirectoryExists(this.videosDir);
  }

  saveImage(file, userId) {
    const extension = path.extname(file.originalname);
    const filename = `${userId}_${uuidv4()}${extension}`;
    const filepath = path.join(this.imagesDir, filename);
    
    fs.writeFileSync(filepath, file.buffer);
    
    return `/uploads/images/${filename}`;
  }

  saveVoiceMessage(file, userId, duration) {
    const filename = `${userId}_${uuidv4()}.webm`;
    const filepath = path.join(this.voiceDir, filename);
    
    fs.writeFileSync(filepath, file.buffer);
    
    return {
      url: `/uploads/voice/${filename}`,
      duration: duration || 0,
      size: file.size,
    };
  }

  deleteFile(fileUrl) {
    try {
      const filepath = path.join(this.uploadDir, fileUrl.replace('/uploads/', ''));
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }
}

module.exports = new UploadService();