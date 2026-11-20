import app from './app.js';
import { env } from './config/env.js';
import { initializeFirebase } from './config/firebase.js';

const startServer = async () => {
  try {
    // Initialize Firebase Admin
    initializeFirebase();

    app.listen(env.PORT, () => {
      console.log(`🚀 Chat Backend server running at http://localhost:${env.PORT}`);
      console.log(`⚡ Environment: ${env.NODE_ENV}`);
      console.log(`🩺 Health check: http://localhost:${env.PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
