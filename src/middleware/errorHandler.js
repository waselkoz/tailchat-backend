const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
  console.error(err.stack);
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: 'Validation error', message: errors.join(', '), code: 'VALIDATION_ERROR' });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({ error: 'Duplicate field', message: `${field} already exists`, code: 'DUPLICATE_ERROR' });
  }
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid ID format', message: `Invalid ${err.path}: ${err.value}`, code: 'INVALID_ID' });
  if (err.name === 'JsonWebTokenError') return res.status(403).json({ error: 'Invalid token', message: 'Authentication failed', code: 'INVALID_TOKEN' });
  if (err.name === 'TokenExpiredError') return res.status(403).json({ error: 'Token expired', message: 'Please login again', code: 'TOKEN_EXPIRED' });
  res.status(statusCode).json({ error: message, code: err.code || 'INTERNAL_ERROR', ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) });
};
module.exports = errorHandler;