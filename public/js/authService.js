import { auth } from './firebaseInit.js';
import {
    signInAnonymously,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js';
import { logDebug, logDebugError } from './debugService.js';

let currentUnsubscribeAuthListener = null;

/**
 * Signs in the user anonymously using Firebase Authentication.
 * @returns {Promise<UserCredential | null>} A promise that resolves with the user credential on successful sign-in, or null on failure.
 */
export async function performAnonymousSignIn() {
    logDebug("authService.performAnonymousSignIn: Attempting anonymous sign-in.");
    try {
        const userCredential = await signInAnonymously(auth);
        logDebug("authService.performAnonymousSignIn: Anonymous sign-in successful. UID:", userCredential.user.uid);
        return userCredential;
    } catch (error) {
        logDebugError("authService.performAnonymousSignIn: Anonymous sign-in failed:", error);
        return null;
    }
}

/**
 * Sets up a listener for Firebase authentication state changes.
 * The listener will call the provided callbacks when the auth state changes.
 * @param {object} callbacks - An object containing callback functions.
 * @param {function} callbacks.onUserSignedIn - Called when a user signs in. Receives the Firebase user object.
 * @param {function} callbacks.onUserSignedOut - Called when a user signs out.
 * @returns {function} Unsubscribe function for the listener.
 */
export function setupAuthListener(callbacks) {
    if (currentUnsubscribeAuthListener) {
        logDebug("authService.setupAuthListener: Unsubscribing from previous auth state listener.");
        currentUnsubscribeAuthListener();
    }

    logDebug("authService.setupAuthListener: Setting up new auth state listener.");
    currentUnsubscribeAuthListener = onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            logDebug("authService.onAuthStateChanged: User is signed in. UID:", user.uid);
            if (callbacks && typeof callbacks.onUserSignedIn === 'function') {
                callbacks.onUserSignedIn(user);
            }
        } else {
            // User is signed out
            logDebug("authService.onAuthStateChanged: User is signed out.");
            if (callbacks && typeof callbacks.onUserSignedOut === 'function') {
                callbacks.onUserSignedOut();
            }
        }
    });
    return currentUnsubscribeAuthListener;
} 