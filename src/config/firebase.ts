import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { env } from './env.js';

let firestoreDb: admin.firestore.Firestore | null = null;

export const initializeFirebase = (): admin.firestore.Firestore => {
  if (firestoreDb) {
    return firestoreDb;
  }

  if (admin.apps.length > 0) {
    firestoreDb = admin.firestore();
    return firestoreDb;
  }

  try {
    if (env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const resolvedPath = path.resolve(process.cwd(), env.FIREBASE_SERVICE_ACCOUNT_PATH);
      if (fs.existsSync(resolvedPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('✅ Firebase Admin initialized with service account file');
      } else {
        console.warn(`⚠️ Firebase service account file not found at: ${resolvedPath}. Falling back to default credentials.`);
        admin.initializeApp();
      }
    } else if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log('✅ Firebase Admin initialized with environment variables');
    } else {
      console.warn('⚠️ No specific Firebase credentials provided. Initializing with application default credentials.');
      admin.initializeApp();
    }
  } catch (err) {
    console.warn('⚠️ Firebase Admin initialization warning:', err instanceof Error ? err.message : err);
  }

  firestoreDb = admin.firestore();
  return firestoreDb;
};

export const getFirestore = (): admin.firestore.Firestore => {
  if (!firestoreDb) {
    return initializeFirebase();
  }
  return firestoreDb;
};
