// Global Application State
// Note: Prefer passing state as parameters or using dedicated state management functions
// where possible, but for this refactoring, we'll group them here first.

import { logDebug } from './debugService.js'; // Assuming debugService is created
import { setDebugServiceMode } from './debugService.js'; // NEW import

/** @type {import('firebase/auth').User | null} */
export let currentFirebaseUser = null;

/** @type {object | null} */
export let currentUserProfile = null;

/** @type {object | null} Holds categorized questions for the evaluation form. */
export let categorizedQuestions = null;

/** @type {Array<object>} List of peers available for evaluation. */
export let peersToEvaluate = [];

/** @type {Set<string>} Firestore IDs of peers already evaluated by the current user in the current session. */
export let evaluatedPeerFirestoreIds = new Set();

/** @type {Array<object>} Submissions made by the current user in the current session. */
export let userSubmissions = []; 

/** @type {boolean} Indicates if the evaluation period is currently open. Managed by listenToAppSettings. */
export let isEvaluationOpen = false; // Default to false; listener will update

/** @type {boolean} Flag indicating if the current user has completed all evaluations in the current open period. */
export let allEvaluationsDoneForCurrentUserInThisOpenPeriod = false;

/** 
 * @type {boolean} 
 * Flag set to true by listenToAppSettings when a live admin reopen occurs for an active user.
 * Consumed by setupEvaluationUI to signal a session reset for that specific user call.
 */
export let evaluationSessionJustResetByAdmin = false; 

/** 
 * @type {boolean} 
 * Flag set by listenToAppSettings when the app detects a transition from closed to open (or initial load into open state).
 * Consumed by setupEvaluationUI to know that the app context has freshly become "open".
 */
export let appHasJustTransitionedToOpen = false;

/** @type {import('firebase/firestore').Unsubscribe | null} Function to unsubscribe from the app settings listener. */
export let appSettingsListenerUnsubscribe = null;

/** @type {Array<object>} Summarized evaluations for the current user. */
export let userSummarizedEvaluations = [];

/** @type {boolean} Indicates if debug mode is active, usually from app_settings. */
export let isDebugMode = false; 

/** @type {number | null} Timestamp of the last global peer reset signal processed by the client. */
export let lastKnownResetAllPeersTimestamp = null;

/** @type {boolean} Flag to indicate the client just processed a global reset signal. */
export let clientJustProcessedGlobalReset = false;

// --- Setter functions to manage state changes and potentially add logging/validation --- 
// (Optional but good practice for larger apps)

export function setCurrentFirebaseUser(user) {
    logDebug("State Change: currentFirebaseUser set to:", user ? user.uid : null);
    currentFirebaseUser = user;
}

export function setCurrentUserProfile(profile) {
    logDebug("State Change: currentUserProfile set to:", profile ? profile.name : null);
    currentUserProfile = profile;
}

export function setCategorizedQuestions(questions) {
    logDebug("State Change: categorizedQuestions updated.");
    categorizedQuestions = questions;
}

export function setPeersToEvaluate(peers) {
    logDebug("State Change: peersToEvaluate updated. Count:", peers.length);
    peersToEvaluate = peers;
}

export function setEvaluatedPeerFirestoreIds(idsSet) {
    logDebug("State Change: evaluatedPeerFirestoreIds updated. Size:", idsSet.size);
    evaluatedPeerFirestoreIds = idsSet;
}

export function addUserSubmission(submission) {
    userSubmissions.push(submission);
    logDebug("State Change: userSubmission added. New count:", userSubmissions.length);
}

export function clearUserSubmissions() {
    userSubmissions = [];
    logDebug("State Change: userSubmissions cleared.");
}

export function setIsEvaluationOpen(isOpen) {
    logDebug("State Change: isEvaluationOpen set to:", isOpen);
    isEvaluationOpen = isOpen;
}

export function setAllEvaluationsDoneForCurrentUserInThisOpenPeriod(isDone) {
    const userName = currentUserProfile ? currentUserProfile.name : (currentFirebaseUser ? currentFirebaseUser.uid : 'UnknownUser/NoFBUser');
    logDebug(`State Change for User '${userName}': allEvaluationsDoneForCurrentUserInThisOpenPeriod set to: ${isDone}`);
    allEvaluationsDoneForCurrentUserInThisOpenPeriod = isDone;
}

export function setEvaluationSessionJustResetByAdmin(isReset) {
    logDebug("State Change: evaluationSessionJustResetByAdmin set to:", isReset);
    evaluationSessionJustResetByAdmin = isReset;
}

export function setAppHasJustTransitionedToOpen(hasTransitioned) {
    logDebug("State Change: appHasJustTransitionedToOpen set to:", hasTransitioned);
    appHasJustTransitionedToOpen = hasTransitioned;
}

export function setAppSettingsListenerUnsubscribe(unsubscribeFn) {
    logDebug("State Change: appSettingsListenerUnsubscribe updated.");
    appSettingsListenerUnsubscribe = unsubscribeFn;
}

export function setUserSummarizedEvaluations(summaries) {
    logDebug("State Change: userSummarizedEvaluations updated. Count:", summaries ? summaries.length : 0);
    userSummarizedEvaluations = summaries || [];
}

export function setIsDebugMode(isDebug) {
    const oldMode = isDebugMode;
    const newMode = !!isDebug; // Ensure boolean

    isDebugMode = newMode; // Set the state variable
    setDebugServiceMode(newMode); // Inform debugService immediately

    // Logging an INFO message about the change in debug mode status.
    // This log should occur regardless of the new debug mode state itself.
    // Using console.log directly to avoid issues if logDebug itself is problematic during this transition.
    if (oldMode !== newMode) {
        console.log(`INFO: State Change: isDebugMode is now ${newMode ? 'ENABLED' : 'DISABLED'}.`);
    }
}

export function setUserSubmissions(newSubmissions) {
    logDebug("State Change: userSubmissions replaced. New count:", newSubmissions ? newSubmissions.length : 0);
    userSubmissions = newSubmissions || [];
}

export function setLastKnownResetAllPeersTimestamp(timestamp) {
    logDebug("State Change: setLastKnownResetAllPeersTimestamp set to:", timestamp);
    lastKnownResetAllPeersTimestamp = timestamp;
}

export function setClientJustProcessedGlobalReset(didProcess) {
    logDebug("State Change: clientJustProcessedGlobalReset set to:", didProcess);
    clientJustProcessedGlobalReset = didProcess;
}

// --- Getter for the entire state ---
export function getState() {
    return {
        currentFirebaseUser,
        currentUserProfile,
        categorizedQuestions,
        peersToEvaluate,
        evaluatedPeerFirestoreIds,
        userSubmissions,
        isEvaluationOpen,
        allEvaluationsDoneForCurrentUserInThisOpenPeriod,
        evaluationSessionJustResetByAdmin,
        appHasJustTransitionedToOpen,
        appSettingsListenerUnsubscribe,
        userSummarizedEvaluations,
        isDebugMode,
        lastKnownResetAllPeersTimestamp,
        clientJustProcessedGlobalReset
    };
}

// --- Utility function to reset user-specific evaluation state ---
export function resetUserEvaluationState() {
    logDebug("State Change: resetUserEvaluationState called.");
    setCurrentUserProfile(null);
    setCategorizedQuestions(null);
    setPeersToEvaluate([]);
    setEvaluatedPeerFirestoreIds(new Set());
    clearUserSubmissions(); // Resets userSubmissions to []
    setAllEvaluationsDoneForCurrentUserInThisOpenPeriod(false);
    setUserSummarizedEvaluations([]); // Reset summarized evaluations
    // Note: Does not reset currentFirebaseUser (handled by auth service)
    // Note: Does not reset app-wide flags like isEvaluationOpen, evaluationSessionJustResetByAdmin, appHasJustTransitionedToOpen
} 