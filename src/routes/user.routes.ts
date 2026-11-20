import { Router } from 'express';
import {
  register,
  login,
  getMe,
  searchUsers,
  getUserById,
  updatePresence,
  getUserPresence,
} from '../controllers/user.controller.js';
import { validateRequest } from '../middlewares/validation.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  createUserSchema,
  loginUserSchema,
  searchUserSchema,
  userIdParamSchema,
  presenceSchema,
} from '../validators/user.validator.js';

const router = Router();

// Public routes
router.post('/register', validateRequest(createUserSchema), register);
router.post('/', validateRequest(createUserSchema), register);
router.post('/login', validateRequest(loginUserSchema), login);

// Authenticated routes
router.get('/me', authenticate, getMe);
router.post('/presence', authenticate, validateRequest(presenceSchema), updatePresence);
router.get('/:id/presence', authenticate, validateRequest(userIdParamSchema), getUserPresence);
router.get('/', authenticate, validateRequest(searchUserSchema), searchUsers);
router.get('/:id', authenticate, validateRequest(userIdParamSchema), getUserById);

export default router;
