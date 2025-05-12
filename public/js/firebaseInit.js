// Firebase Service Initialization

// Import Firebase app and specific services
// Using CDN paths for consistency with existing script.js imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js';
// If Analytics is used, uncomment:
// import { getAnalytics } from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-analytics.js';

// Import the Firebase configuration
import { firebaseConfig } from './config.js';
import { logDebug } from './debugService.js';

/**
 * Initializes the Firebase application.
 * @type {import('firebase/app').FirebaseApp}
 */
const app = initializeApp(firebaseConfig);
logDebug("Firebase app initialized in firebaseInit.js");

/**
 * Firebase Authentication service instance.
 * @type {import('firebase/auth').Auth}
 */
const auth = getAuth(app);
logDebug("Firebase Auth service initialized in firebaseInit.js");

/**
 * Firebase Firestore service instance.
 * @type {import('firebase/firestore').Firestore}
 */
const db = getFirestore(app);
logDebug("Firebase Firestore service initialized in firebaseInit.js");

// If Analytics is used, uncomment:
// const analytics = getAnalytics(app);
// logDebug("Firebase Analytics service initialized in firebaseInit.js");

// Export the initialized services for use in other modules
export { app, auth, db };
// If Analytics is used, add 'analytics' to the export: export { app, auth, db, analytics }; 