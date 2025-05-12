// Main application orchestrator: main.js
import { logDebug, logDebugWarn, logDebugError } from './debugService.js';

logDebug("main.js loading...");

// Firebase services (db, auth are initialized within these modules if not already)
import { auth } from './firebaseInit.js'; // Ensures auth is initialized
import * as authService from './authService.js';
import * as firestoreService from './firestoreService.js';

// State management
import * as state from './state.js';

// UI Element Selectors
import * as uiElements from './uiElements.js';

// UI Helper functions (simple show/hide, messages)
import * as uiHelpers from './uiHelpers.js';

// UI Rendering functions (complex DOM updates)
import * as uiRenderer from './uiRenderer.js';

// Evaluation logic and business rules
import * as evaluationManager from './evaluationManager.js';

// --- Global Unsubscribe Functions --- 
// To keep track of listeners and clean them up if re-initializing
let unsubscribeAuth = null;
let unsubscribeAppSettings = null;

// --- Core UI Refresh Function ---
/**
 * Central function to refresh the entire UI based on the current application state.
 * It gathers all necessary data and callbacks for the uiRenderer.
 * @param {Array<object> | undefined} explicitSummaries - Optional. If provided, these summaries are used directly.
 */
async function refreshUI(explicitSummaries) {
    let currentState = state.getState();
    logDebug("main.js refreshUI() called. Current user profile:", currentState.currentUserProfile ? currentState.currentUserProfile.name : "None");

    if (explicitSummaries) {
        logDebug("main.js refreshUI(): Using EXPLICIT summaries provided. Count:", explicitSummaries.length);
        // Create a new state object for uiRenderer, overriding userSummarizedEvaluations
        currentState = {
            ...currentState, // Spread the rest of the state
            userSummarizedEvaluations: explicitSummaries // Override with explicit summaries
        };
        // Optionally, also update the global state if desired, though the explicit pass is key here
        // state.setUserSummarizedEvaluations(explicitSummaries);
    } else {
        logDebug("main.js refreshUI(): No explicit summaries, using summaries from state.getState().");
    }

    logDebug("main.js refreshUI(): summarizedEvaluations for updateMainUI IS:", currentState.userSummarizedEvaluations);
    logDebug("main.js refreshUI(): summarizedEvaluations for updateMainUI LENGTH IS:", currentState.userSummarizedEvaluations ? currentState.userSummarizedEvaluations.length : 'N/A');
    uiHelpers.showLoading(); // Show loading indicator during refresh

    const interactionCallbacks = {
        onPeerClick: async (peer) => {
            logDebug("main.js onPeerClick for peer:", peer.name);
            uiHelpers.showLoading();
            evaluationManager.loadEvaluationForm(
                peer,
                (peerData, questionsData) => { // onFormReady
                    uiRenderer.renderEvaluationForm(peerData, questionsData);
                    // After form is rendered, try to attach listener for debug button
                    if (state.getState().isDebugMode) {
                        const fillRandomButton = document.getElementById('fillRandomScoresButton');
                        if (fillRandomButton) {
                            fillRandomButton.addEventListener('click', () => {
                                logDebug("'Fill Random Scores' button clicked.");
                                evaluationManager.fillFormWithRandomScores();
                            });
                        } else {
                            logDebugWarn("'fillRandomScoresButton' not found after rendering form in debug mode.");
                        }
                    }
                    uiHelpers.hideLoading();
                },
                (errorMsg) => { // onError
                    uiHelpers.showError(errorMsg, uiElements.evaluationMessage);
                    uiHelpers.hideLoading();
                }
            );
        },
        onPeerStatsClick: (event, peerId) => {
            logDebug("main.js onPeerStatsClick for peerId:", peerId);
            // The getPeerAveragesFn will be evaluationManager.calculateAndGetPeerAveragesFromState
            uiRenderer.togglePeerStatsDropdown(event, peerId, evaluationManager.calculateAndGetPeerAveragesFromState);
        },
        fetchSummariesAndRender: async (userId) => {
            if (!userId) return;
            logDebug("main.js fetchSummariesAndRender for userId:", userId);
            uiHelpers.showLoading();
            try {
                const summaries = await firestoreService.fetchUserSummarizedEvaluations(userId);
                state.setUserSummarizedEvaluations(summaries); // Update state
                uiRenderer.displayPeerEvaluationSummary(summaries); 
                uiRenderer.renderEvaluationChart(summaries);
                // Ensure containers are visible if they have content
                if (summaries && summaries.length > 0) {
                    if(uiElements.peerEvaluationSummaryContainer) uiElements.peerEvaluationSummaryContainer.style.display = 'block';
                    if(uiElements.statsVisualizationContainer) uiElements.statsVisualizationContainer.style.display = 'block';
                } else {
                    if(uiElements.peerEvaluationSummaryContainer) {
                        uiElements.peerEvaluationSummaryContainer.innerHTML = '<p>No evaluation summary data to display.</p>';
                        uiElements.peerEvaluationSummaryContainer.style.display = 'block';
                    }
                    if(uiElements.statsVisualizationContainer) uiElements.statsVisualizationContainer.style.display = 'none';
                }
            } catch (error) {
                logDebugError("Error fetching or rendering summaries:", error);
                if(uiElements.peerEvaluationSummaryContainer) {
                    uiElements.peerEvaluationSummaryContainer.innerHTML = '<p>Could not load summary data.</p>';
                    uiElements.peerEvaluationSummaryContainer.style.display = 'block';
                }
                if(uiElements.statsVisualizationContainer) uiElements.statsVisualizationContainer.style.display = 'none';
            } finally {
                uiHelpers.hideLoading();
            }
        }
    };

    uiRenderer.updateMainUI(currentState, interactionCallbacks);
    uiHelpers.hideLoading(); // Ensure loading is hidden after UI update
}

// --- Initialization Functions ---

/**
 * Initializes application listeners (Auth and AppSettings).
 */
function initializeAppListeners() {
    logDebug("main.js initializeAppListeners().");
    // Clean up previous listeners if any
    if (unsubscribeAuth) unsubscribeAuth();
    if (unsubscribeAppSettings) unsubscribeAppSettings();

    // Auth State Listener
    unsubscribeAuth = authService.setupAuthListener({
        onUserSignedIn: async (firebaseUser) => {
            logDebug("main.js onUserSignedIn, UID:", firebaseUser.uid);
            state.setCurrentFirebaseUser(firebaseUser);
            // If a user signs in (even anonymously), we don't necessarily have their app profile yet.
            // Profile is loaded via handleLogin.
            // If currentUserProfile is already set (e.g. from a previous session + code login), 
            // and firebaseUser matches, we might not need to do much beyond UI refresh.
            // For now, a simple refresh is fine. Login flow handles profile loading.
            if (!state.getState().currentUserProfile) {
                 // This implies an anonymous sign-in without a code login yet.
                 // The UI should reflect the "logged out" state until code login.
                logDebug("main.js onUserSignedIn: No app profile yet, waiting for code login.");
            }
            await refreshUI(); // Refresh UI to reflect signed-in (anonymous) state
        },
        onUserSignedOut: async () => {
            logDebug("main.js onUserSignedOut.");
            state.setCurrentFirebaseUser(null);
            state.setCurrentUserProfile(null);
            state.resetUserEvaluationState(); // Clear all user-specific evaluation data
            uiRenderer.clearEvaluationForm(); // Clear the form specifically
            await refreshUI(); // Refresh UI to show login screen
        }
    });

    // App Settings Listener
    unsubscribeAppSettings = firestoreService.listenToAppSettings({
        onSettingsChange: async (newIsOpenState, newIsDebugMode, newResetAllPeersTimestamp, newSettingsData) => {
            const oldIsOpenState = state.getState().isEvaluationOpen;
            const oldIsDebugMode = state.getState().isDebugMode;
            const lastProcessedResetTimestamp = state.getState().lastKnownResetAllPeersTimestamp;
            
            // console.log(`INFO: main.js AppSettings changed. OldOpen: ${oldIsOpenState}, NewOpen: ${newIsOpenState}. OldDebug: ${oldIsDebugMode}, NewDebug: ${newIsDebugMode}. NewResetSignal: ${newResetAllPeersTimestamp}, LastProcessedReset: ${lastProcessedResetTimestamp}`);
            // Simplified log for brevity in most cases
            logDebug(`main.js AppSettings changed. NewOpen: ${newIsOpenState}, NewDebug: ${newIsDebugMode}, NewReset: ${newResetAllPeersTimestamp}`);

            state.setIsEvaluationOpen(newIsOpenState);
            state.setIsDebugMode(newIsDebugMode); 
            // state.setAppSettings(newSettingsData); // If we store full settings object

            // Check for a new global reset signal
            if (newResetAllPeersTimestamp && newResetAllPeersTimestamp !== lastProcessedResetTimestamp) {
                console.log(`USER_INFO: Global evaluation reset signal (timestamp: ${newResetAllPeersTimestamp}) detected from admin. Resetting current user's local evaluation state.`);
                uiHelpers.showError("Administrator has reset all evaluation data. Your previous evaluations for this session have been cleared.", uiElements.evaluationMessage); // Show prominent message
                
                // Reset current user's local state
                state.setAllEvaluationsDoneForCurrentUserInThisOpenPeriod(false);
                state.setEvaluatedPeerFirestoreIds(new Set());
                state.setUserSubmissions([]);
                state.setLastKnownResetAllPeersTimestamp(newResetAllPeersTimestamp); // Mark this reset signal as processed
                state.setClientJustProcessedGlobalReset(true); // Signal to setupEvaluationUI not to fetch

                if (state.getState().currentUserProfile) {
                    // If a user is logged in, force a full data refresh and UI update
                    // This will re-fetch peers, questions and effectively start them fresh, 
                    // reflecting the (assumed) cleared state in Firestore.
                    logDebug("Global reset: User logged in, re-running setupEvaluationUI.");
                    uiHelpers.showLoading();
                    await evaluationManager.setupEvaluationUI(refreshUI);
                    return; // Return early as setupEvaluationUI will call refreshUI
                } else {
                    // If no user logged in, just refresh the UI (which will likely show login screen)
                    await refreshUI();
                    return; // Return early
                }
            }

            if (oldIsDebugMode !== newIsDebugMode) {
                console.log(`USER_INFO: Debug mode has been ${newIsDebugMode ? 'ENABLED' : 'DISABLED'}. Debug logs will be ${newIsDebugMode ? 'shown' : 'hidden'}.`);
                // If debug mode changed, we might want to refresh UI if debug-specific elements depend on it.
                // The auto-fill button visibility will be handled by renderEvaluationForm and refreshUI.
            }

            if (oldIsOpenState === false && newIsOpenState === true) {
                logDebug("main.js AppSettings: REOPENING DETECTED or initial load to OPEN.");
                state.setAppHasJustTransitionedToOpen(true); // Flag for setupEvaluationUI logic

                if (state.getState().currentUserProfile) {
                    logDebug("main.js AppSettings: User logged in during REOPEN. Resetting session.");
                    // This is a live admin reopen for an active user.
                    // Clear local evaluation progress for this user FOR THIS SESSION.
                    // Firestore data for *other* sessions or users is untouched here.
                    state.setAllEvaluationsDoneForCurrentUserInThisOpenPeriod(false);
                    state.setEvaluatedPeerFirestoreIds(new Set());
                    state.setUserSubmissions([]);
                    state.setEvaluationSessionJustResetByAdmin(true); // Critical flag for setupEvaluationUI
                    
                    uiHelpers.showLoading();
                    // Re-run setup to fetch peers, questions, and apply new open state logic
                    await evaluationManager.setupEvaluationUI(refreshUI); 
                } else {
                    // No user logged in, just update the UI shell (e.g. show evaluation is open)
                    await refreshUI();
                }
            } else if (oldIsOpenState === true && newIsOpenState === false) {
                logDebug("main.js AppSettings: CLOSING DETECTED.");
                 uiRenderer.clearEvaluationForm(); // Clear form if it was open
                await refreshUI();
            } else if (oldIsOpenState !== newIsOpenState) { // Synchronize on other changes or initial load
                logDebug("main.js AppSettings: State synchronized or minor discrepancy.");
                 if (newIsOpenState === true && state.getState().currentUserProfile) {
                    // If it simply synchronized to OPEN and user is logged in, ensure setup is run correctly
                    state.setAppHasJustTransitionedToOpen(true);
                    uiHelpers.showLoading();
                    await evaluationManager.setupEvaluationUI(refreshUI);
                 } else {
                    await refreshUI();
                 }
            } else {
                 logDebug("main.js AppSettings: No significant change in isOpen or already handled by reopen logic.");
                 // If only other settings changed, just refresh UI
                 // await refreshUI(); // Potentially, if other settings affect UI directly. For now, isOpen is key.
            }
        }
    });
}

/**
 * Attaches event listeners to DOM elements.
 */
function attachEventListeners() {
    logDebug("main.js attachEventListeners().");
    if (uiElements.loginButton) {
        uiElements.loginButton.addEventListener('click', async () => {
            await evaluationManager.handleLogin(
                async () => { await refreshUI(); }, // onLoginSuccess: refresh the UI
                async () => { await refreshUI(); }  // onLoginFailure: also refresh UI (to show error on login screen)
            );
        });
    } else {
        logDebugError("main.js: loginButton not found!");
    }

    if (uiElements.userCodeInput) {
        uiElements.userCodeInput.addEventListener('keypress', async (event) => {
            if (event.key === "Enter") {
                event.preventDefault(); // Prevent default form submission if any
                await evaluationManager.handleLogin(
                    async () => { await refreshUI(); }, 
                    async () => { await refreshUI(); }
                );
            }
        });
    }

    if (uiElements.submitEvaluationButton) {
        uiElements.submitEvaluationButton.addEventListener('click', async () => {
            await evaluationManager.handleSubmitEvaluation(async (summariesFromSubmit) => { // Expect summaries here
                uiRenderer.clearEvaluationForm(); // Hide form first
                await refreshUI(summariesFromSubmit); // Pass summaries to refreshUI
            });
        });
    } else {
        logDebugWarn("main.js: submitEvaluationButton not found during event listener setup."); // Changed to warn as it might not always be critical if hidden
    }
    
    // Setup global click listener for dropdowns from uiRenderer
    uiRenderer.setupGlobalClickListenerForDropdowns();

    if (uiElements.reEvaluateButton) {
        uiElements.reEvaluateButton.addEventListener('click', async () => {
            logDebug("main.js 'Re-evaluate again?' button clicked.");
            if (state.getState().isEvaluationOpen) {
                const success = evaluationManager.requestReEvaluation();
                if (success) {
                    uiRenderer.clearEvaluationForm(); // Clear any open form
                    await refreshUI(); // Refresh UI to show peer list
                } else {
                    // This case should ideally not be hit if button visibility is correct
                    uiHelpers.showError("Cannot re-evaluate at this time.", uiElements.evaluationMessage); 
                }
            } else {
                uiHelpers.showError("Evaluations are currently closed. Re-evaluation is not possible.", uiElements.evaluationMessage); // Or a more prominent general message area
            }
        });
    } else {
        logDebugWarn("main.js: reEvaluateButton not found during event listener setup."); // Changed to warn as it might not always be critical if hidden
    }
}

/**
 * Main application entry point.
 */
async function main() {
    logDebug("main.js main() function started.");
    uiHelpers.showLoading();

    // Initialize dynamic UI elements first
    uiElements.initializeDynamicElements();

    // Initialize Firebase services (auth will be initialized here)
    try {
        await authService.performAnonymousSignIn(); // Ensure anonymous sign-in completes
        logDebug("main.js: Anonymous sign-in successful or already signed in.");

        // NOW initialize app listeners, including appSettings, AFTER anonymous auth is likely set.
        initializeAppListeners(); 

    } catch (error) {
        logDebugError("main.js: Critical error during anonymous sign-in:", error);
        // Handle critical failure: maybe show an error message and stop app execution
        uiHelpers.showError("Critical application error: Could not sign in. Please refresh.", document.body); 
        // Fallback or stop further initialization if anonymous sign-in fails.
        // For now, we might still try to initializeAppListeners if some parts can work without auth,
        // but appSettings listener might still fail if rules need request.auth != null.
        // Let's assume for now that if this fails, app functionality will be severely limited.
        // initializeAppListeners(); // Decide if this should run on failure
    }

    // Setup other UI elements and event listeners that don't depend on immediate auth state from listeners
    attachEventListeners();
    uiRenderer.setupGlobalClickListenerForDropdowns();

    // Initialize dynamic UI elements that might not be in initial HTML (e.g. summary containers)
    const appContainer = document.querySelector('.container'); // Main app container
    if (appContainer) {
        // Ensure the peerEvaluationSummaryContainer exists in the DOM
        if (uiElements.peerEvaluationSummaryContainer && !uiElements.peerEvaluationSummaryContainer.parentElement) {
            appContainer.appendChild(uiElements.peerEvaluationSummaryContainer);
            logDebug("main.js: Added peerEvaluationSummaryContainer to DOM");
        }
        
        // Ensure the evaluationClosedMessage exists in the DOM
        if (uiElements.evaluationClosedMessage && !uiElements.evaluationClosedMessage.parentElement) {
            appContainer.appendChild(uiElements.evaluationClosedMessage);
            logDebug("main.js: Added evaluationClosedMessage to DOM");
        }
        
        // CRITICAL: Ensure stats visualization container with canvas is appended
        if (uiElements.statsVisualizationContainer && !uiElements.statsVisualizationContainer.parentElement) {
            // Add a title for the visualization if it doesn't already have one
            if (!uiElements.statsVisualizationContainer.querySelector('h3')) {
                const title = document.createElement('h3');
                title.textContent = 'Evaluation Statistics Overview';
                uiElements.statsVisualizationContainer.insertBefore(title, uiElements.statsVisualizationContainer.firstChild);
            }
            
            // Append to the DOM
            appContainer.appendChild(uiElements.statsVisualizationContainer);
            logDebug("main.js: Added statsVisualizationContainer with canvas to DOM");
        }
    } else {
        logDebugError("main.js: Cannot find .container element to attach dynamic UI components!");
    }

    // Initial UI render based on default state (likely no user, system state from listener soon)
    // The listeners will trigger further refreshes as data comes in.
    await refreshUI(); 
    logDebug("main.js main() function completed.");
}

// --- Run the App ---
document.addEventListener('DOMContentLoaded', main);

logDebug("main.js loaded and event listener attached."); 