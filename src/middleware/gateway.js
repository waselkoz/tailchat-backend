const validateRequest = (req, res, next) => next();
const transformResponse = (req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    const response = { success: true, data, meta: { requestId: req.requestId, timestamp: new Date().toISOString() } };
    originalJson.call(this, response);
  };
  next();
};
module.exports = { validateRequest, transformResponse };