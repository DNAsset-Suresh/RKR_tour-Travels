export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.name === 'Error' && [409,422,502,503].includes(error.status)) return res.status(error.status).json({error:{message:error.message}});
  if (error.type === 'entity.too.large') return res.status(413).json({ error: { message: 'Your request is too large.' } });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: { message: 'Send a valid JSON request.' } });
  const unavailable = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', '28P01', '3D000', '57P01', '53300'].includes(error.code) || /connection|timeout/i.test(error.message || '');
  console.error('Request failed:', error.code || error.name);
  res.status(unavailable ? 503 : 500).json({ error: { message: unavailable ? 'Our booking service is temporarily unavailable. Please try again shortly. Your request has not been confirmed.' : 'We could not save your request. Please try again.' } });
}
