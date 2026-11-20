import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/response.js';

export class UserService {
  static generateToken(user: { id: string; name: string; email: string }): string {
    return jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions
    );
  }

  static async createUser(data: { name: string; email: string }) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new AppError('A user with this email already exists', 409);
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
      },
    });

    const token = this.generateToken(user);
    return { user, token };
  }

  static async loginUser(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new AppError('User not found with this email', 404);
    }

    const token = this.generateToken(user);
    return { user, token };
  }

  static async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  static async searchUsers(query?: string, currentUserId?: string, limit = 20, offset = 0) {
    const users = await prisma.user.findMany({
      where: {
        AND: [
          currentUserId ? { id: { not: currentUserId } } : {},
          query
            ? {
                OR: [
                  { name: { contains: query, mode: 'insensitive' } },
                  { email: { contains: query, mode: 'insensitive' } },
                ],
              }
            : {},
        ],
      },
      select: { id: true, name: true, email: true, createdAt: true },
      take: limit,
      skip: offset,
      orderBy: { name: 'asc' },
    });

    return users;
  }
}
