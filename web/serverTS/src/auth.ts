import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { CONFIG } from './config';
import { db } from './database';

export interface UserPayload {
    sub: string; // username
    user_id: number;
    role: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: UserPayload;
        }
    }
}

export function generateToken(user: { username: string, id: number, role: string }): string {
    const payload: UserPayload = {
        sub: user.username,
        user_id: user.id,
        role: user.role
    };
    // Expires in 7 days to match python default (approx)
    return jwt.sign(payload, CONFIG.JWT_SECRET, { expiresIn: '7d', algorithm: CONFIG.JWT_ALGORITHM as jwt.Algorithm });
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ detail: "Not authenticated" });

    jwt.verify(token, CONFIG.JWT_SECRET, async (err, decoded) => {
        if (err) {
            console.error("Token verification failed:", err.message);
            return res.status(403).json({ detail: "Invalid token" });
        }
        
        let payload = decoded as UserPayload;
        // console.log("Decoded payload:", payload);

        // Compatibility with Python token (which has no user_id)
        if (!payload.user_id && payload.sub) {
             try {
                 const user = await db.getUser(payload.sub);
                 if (user) {
                     payload = { ...payload, user_id: user.id, role: user.role };
                 } else {
                     console.error("User not found for legacy token sub:", payload.sub);
                     return res.status(403).json({ detail: "User not found" });
                 }
             } catch (e) {
                 console.error("Error fetching user for token compatibility:", e);
                 return res.status(500).json({ detail: "Auth error" });
             }
        }

        req.user = payload;
        next();
    });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.user) {
         console.error("requireAdmin: No user in request");
         return res.status(401).json({ detail: "Not authenticated" });
    }
    if (req.user.role !== 'admin') {
        console.error(`requireAdmin: User ${req.user.sub} (role: ${req.user.role}) is not admin`);
        return res.status(403).json({ detail: "Admin access required" });
    }
    next();
}
