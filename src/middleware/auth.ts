import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name?: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'metabit_secret_key_123';

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: string; email: string; name?: string };
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Error verifying custom JWT token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
