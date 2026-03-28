const logger = (req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Started`);
  res.on('finish', () => {
    const duration = Date.now() - start;
    const sc = res.statusCode;
    const msg = `[${new Date().toISOString()}] ${sc >= 400 ? 'N' : 'Y'} ${req.method} ${req.path} - ${sc} - ${duration}ms`;
    if (sc >= 500) console.error(msg);
    else if (sc >= 400) console.warn(msg);
    else console.log(msg);
  });
  next();
};
const errorLogger = (err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);
  console.error(`Stack: ${err.stack}`);
  next(err);
};
const requestId = (req, res, next) => {
  req.requestId = Math.random().toString(36).substring(2, 15);
  res.setHeader('X-Request-Id', req.requestId);
  next();
};
module.exports = { logger, errorLogger, requestId };