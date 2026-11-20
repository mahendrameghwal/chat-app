import { Response, NextFunction } from 'express';
import { UserService } from '../services/user.service.js';
import { PresenceService } from '../services/presence.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess } from '../utils/response.js';

export const register = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email } = req.body;
    const result = await UserService.createUser({ name, email });
    sendSuccess(res, result, 'User created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;
    const result = await UserService.loginUser(email);
    // Mark as online on login
    await PresenceService.updatePresence(result.user.id, true);
    sendSuccess(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await UserService.getUserById(req.user!.id);
    sendSuccess(res, user, 'Profile retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const searchUsers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search, limit, offset } = req.query as unknown as {
      search?: string;
      limit: number;
      offset: number;
    };
    const users = await UserService.searchUsers(search, req.user?.id, limit, offset);
    
    // Enrich users with presence status
    const userIds = users.map((u) => u.id);
    const presenceMap = await PresenceService.getUsersPresence(userIds);
    const enrichedUsers = users.map((u) => ({
      ...u,
      presence: presenceMap[u.id] || { isOnline: false },
    }));

    sendSuccess(res, { users: enrichedUsers }, 'Users retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const userId = Array.isArray(rawId) ? rawId[0] : rawId;
    const user = await UserService.getUserById(userId);
    const presence = await PresenceService.getUserPresence(userId);
    sendSuccess(res, { ...user, presence }, 'User details retrieved');
  } catch (error) {
    next(error);
  }
};

export const updatePresence = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { isOnline } = req.body;
    const result = await PresenceService.updatePresence(req.user!.id, isOnline);
    sendSuccess(res, result, 'Presence updated');
  } catch (error) {
    next(error);
  }
};

export const getUserPresence = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawId = req.params.id;
    const userId = Array.isArray(rawId) ? rawId[0] : rawId;
    const result = await PresenceService.getUserPresence(userId);
    sendSuccess(res, result, 'Presence retrieved');
  } catch (error) {
    next(error);
  }
};
