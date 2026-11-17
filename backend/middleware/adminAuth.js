import { timingSafeEqual } from 'node:crypto';
export function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_API_KEY || '';
  const supplied = req.get('authorization')?.replace(/^Bearer /, '') || '';
  if (expected.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(401).json({ error: { message: 'Administrator authentication is required.' } });
  }
  next();
}
