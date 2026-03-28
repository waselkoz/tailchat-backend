const { validationResult, body, param } = require('express-validator');
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const extracted = errors.array().map(e => ({ field: e.param, message: e.msg }));
  return res.status(400).json({ error: 'Validation failed', errors: extracted, code: 'VALIDATION_ERROR' });
};
const validateRegister = [body('username').trim().isLength({ min: 3, max: 30 }).withMessage('3-30 chars'), body('email').isEmail().withMessage('Invalid email').normalizeEmail(), body('password').isLength({ min: 6 }).withMessage('Min 6 chars'), validate];
const validateLogin = [body('email').isEmail().withMessage('Invalid email'), body('password').notEmpty().withMessage('Required'), validate];
const validateGroupChat = [body('name').trim().isLength({ min: 1, max: 50 }).withMessage('1-50 chars'), body('participants').optional().isArray().withMessage('Array required'), validate];
const validateMessage = [body('content').trim().notEmpty().withMessage('Required').isLength({ max: 2000 }).withMessage('Max 2000 chars'), body('type').optional().isIn(['text', 'image', 'file', 'voice']).withMessage('Invalid type'), validate];
const validateId = [param('id').isMongoId().withMessage('Invalid format'), validate];
module.exports = { validateRegister, validateLogin, validateGroupChat, validateMessage, validateId };