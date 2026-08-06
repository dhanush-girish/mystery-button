import { verifyToken } from '@clerk/backend';

/**
 * Verifies the Clerk JWT from the Authorization header.
 * Returns the userId if valid, or sends a 401 response and returns null.
 */
export async function verifyAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return null;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return payload.sub; // This is the Clerk userId
  } catch (err) {
    console.error('Token verification failed:', err.message);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return null;
  }
}

