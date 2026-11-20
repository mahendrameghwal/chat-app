import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { sendError } from './utils/response.js';

const app = express();

// Security and utility middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets
app.use(express.static('public'));

// API Base Route
app.use('/api/v1', routes);
app.use('/health', (req, res) => res.redirect('/api/v1/health'));

// 404 Handler
app.use((req, res) => {
  return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
});

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
