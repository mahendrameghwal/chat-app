import { Router } from 'express';
import userRoutes from './user.routes.js';
import chatRoutes from './chat.routes.js';
import { getUserChats } from '../controllers/chat.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

// Health Check Endpoint
router.get('/health', (req, res) => {
  return sendSuccess(
    res,
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    'Service is operational'
  );
});

// Domain Routes
router.use('/users', userRoutes);
router.use('/chats', chatRoutes);

// Support Requirement.md root path conventions: /chat/* and /user/:userId/chats
router.use('/chat', chatRoutes);
router.get('/user/:userId/chats', authenticate, getUserChats);

export default router;
