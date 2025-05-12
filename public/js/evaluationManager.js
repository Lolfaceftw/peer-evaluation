import * as firestoreService from './firestoreService.js';

import {
    getState,
    setCurrentUserProfile,
    setCategorizedQuestions,
    setPeersToEvaluate,
    setEvaluatedPeerFirestoreIds,
    setUserSubmissions,
    setAllEvaluationsDoneForCurrentUserInThisOpenPeriod,
    setEvaluationSessionJustResetByAdmin,
    setAppHasJustTransitionedToOpen,
    setClientJustProcessedGlobalReset,
    setUserSummarizedEvaluations
    // getIsEvaluationOpen // We'll get this from getState()
} from './state.js';

import {
    loginError, 
    evaluationMessage, 
    evaluatingPeerName,
    questionsForm,
    submitEvaluationButton
} from './uiElements.js';

import {
    showLoading,
    hideLoading,
    showError,
    showSuccess,
} from './uiHelpers.js';

import { logDebug, logDebugWarn, logDebugError } from './debugService.js';

// Placeholder for UI rendering functions that will eventually be in their own module(s)
// For now, direct DOM manipulation might occur here or rely on uiHelpers for simple tasks.
// We will need a function to call from main.js to update the entire UI based on state.
// Let's assume a function `refreshFullUI` will be available, called from main.js after state changes.

/**
 * Handles the user login process.
 * - Validates user code.
 * - Fetches user profile from Firestore.
 * - Updates application state with user profile.
 * - Triggers the setup of the evaluation UI.
 * @param {Function} onLoginSuccess - Callback to execute after successful login and UI setup.
 * @param {Function} onLoginFailure - Callback to execute on login failure.
 */
export async function handleLogin(onLoginSuccess, onLoginFailure) {
    showLoading();
    // Reset relevant state for a new login session
    setAllEvaluationsDoneForCurrentUserInThisOpenPeriod(false);
    // setEvaluationSessionJustResetByAdmin(false); // This should be managed by the app settings listener logic

    const userCodeInput = document.getElementById('userCodeInput'); // Assuming it's still accessed directly here
    const userCode = userCodeInput.value.trim();
    if (!userCode) {
        showError('Please enter your code.', loginError);
        if (onLoginFailure) onLoginFailure();
        return;
    }

    try {
        logDebug("evaluationManager.handleLogin: Starting login with code:", userCode);
        if (loginError) loginError.textContent = '';

        // authService.performAnonymousSignIn() should have already been called at app init.
        // We just need the user profile based on the code.
        const userProfileData = await firestoreService.loginUserWithCode(userCode);

        if (userProfileData) {
            setCurrentUserProfile(userProfileData);
            logDebug("evaluationManager.handleLogin: User profile loaded, proceeding to setupEvaluationUI.");
            await setupEvaluationUI(); // This will fetch data and then trigger a full UI update via main.js
            if (onLoginSuccess) onLoginSuccess();
        } else {
            logDebug("evaluationManager.handleLogin: Invalid code or user not found.");
            showError('Invalid code or user not found.', loginError);
            setCurrentUserProfile(null);
            hideLoading();
            if (onLoginFailure) onLoginFailure();
        }
    } catch (error) {
        logDebugError("evaluationManager.handleLogin:", error);
        showError(`Login failed: ${error.message}. Check console.`, loginError);
        setCurrentUserProfile(null);
        hideLoading();
        if (onLoginFailure) onLoginFailure();
    }
}

/**
 * Sets up the main evaluation interface after a successful login.
 * - Fetches questions, peers, and past submissions.
 * - Determines the initial state of evaluations (e.g., all done).
 * - This function primarily fetches data and updates state. UI rendering is delegated.
 * @param {Function} onSetupComplete - Callback to run after setup to refresh the UI.
 */
export async function setupEvaluationUI(onSetupComplete) {
    showLoading();
    const { currentUserProfile, isEvaluationOpen, appHasJustTransitionedToOpen, 
            evaluationSessionJustResetByAdmin: globalEvalSessionReset, 
            clientJustProcessedGlobalReset 
          } = getState();

    if (!currentUserProfile) {
        logDebugError("evaluationManager.setupEvaluationUI: Cannot setup UI without a user profile.");
        showError("User profile not loaded. Please try logging in again.", evaluationMessage);
        hideLoading();
        setAllEvaluationsDoneForCurrentUserInThisOpenPeriod(false); // Ensure not complete if no profile
        if (onSetupComplete) onSetupComplete();
        return;
    }

    logDebug("evaluationManager.setupEvaluationUI: Initial states: isEvaluationOpen=", isEvaluationOpen, 
                "appHasJustTransitionedToOpen=", appHasJustTransitionedToOpen, 
                "global.evaluationSessionJustResetByAdmin=", globalEvalSessionReset,
                "clientJustProcessedGlobalReset=", clientJustProcessedGlobalReset);

    let shouldFetchPreviousSubmissions = true;

    if (clientJustProcessedGlobalReset) {
        logDebug("evaluationManager.setupEvaluationUI: Client just processed global reset. Will not fetch old submissions.");
        shouldFetchPreviousSubmissions = false;
        setClientJustProcessedGlobalReset(false); // Consume the flag
    } else if (globalEvalSessionReset) {
        logDebug("evaluationManager.setupEvaluationUI: Global evaluationSessionJustResetByAdmin is TRUE. Will not fetch old submissions.");
        shouldFetchPreviousSubmissions = false;
        setEvaluationSessionJustResetByAdmin(false); // Consume the global flag
    } else if (isEvaluationOpen && appHasJustTransitionedToOpen) {
        logDebug("evaluationManager.setupEvaluationUI: Consuming appHasJustTransitionedToOpen. Will fetch previous submissions if any.");
        // setAllEvaluationsDoneForCurrentUserInThisOpenPeriod(false); // Already done by handleLogin
        shouldFetchPreviousSubmissions = true; 
        setAppHasJustTransitionedToOpen(false); // Consume the app-level flag
    } else {
        logDebug("evaluationManager.setupEvaluationUI: Standard refresh or ongoing session. Will fetch previous submissions.");
        shouldFetchPreviousSubmissions = true;
    }

    logDebug("evaluationManager.setupEvaluationUI: Determined shouldFetchPreviousSubmissions =", shouldFetchPreviousSubmissions);

    let fetchSuccess = false;
    try {
        const fetchedQuestions = await firestoreService.fetchCategorizedQuestions();
        setCategorizedQuestions(fetchedQuestions || {}); 
        logDebug("evaluationManager.setupEvaluationUI: Fetched categorized questions.");

        const fetchedPeers = await firestoreService.fetchPeersForEvaluation(currentUserProfile.id);
        setPeersToEvaluate(fetchedPeers || []);
        logDebug("evaluationManager.setupEvaluationUI: Fetched", (fetchedPeers || []).length, "peers.");

        if (shouldFetchPreviousSubmissions) {
            logDebug("evaluationManager.setupEvaluationUI: Fetching user submissions from Firestore.");
            const submissions = await firestoreService.fetchUserSubmittedEvaluations(currentUserProfile.id);
            setUserSubmissions(submissions || []);
            setEvaluatedPeerFirestoreIds(new Set((submissions || []).map(sub => sub.evaluatedPeerId)));
            logDebug("evaluationManager.setupEvaluationUI: User submissions fetched. Evaluated IDs:", Array.from(getState().evaluatedPeerFirestoreIds));
        } else {
            logDebug("evaluationManager.setupEvaluationUI: Skipping fetch of user submissions. Ensuring local submission state is clear.");
            setUserSubmissions([]); // Explicitly clear if not fetching
            setEvaluatedPeerFirestoreIds(new Set()); // Explicitly clear if not fetching
        }
        
        fetchSuccess = true; // All critical fetches presumed successful if no error thrown

    } catch (error) {
        logDebugError("Error during data fetching in evaluationManager.setupEvaluationUI:", error);
        showError("Failed to load essential evaluation data. Please refresh the page.", evaluationMessage);
        setAllEvaluationsDoneForCurrentUserInThisOpenPeriod(false); // Explicitly ensure not complete on error
        fetchSuccess = false;
        // Clear potentially partially loaded data to prevent inconsistent state
        setCategorizedQuestions({}); 
        setPeersToEvaluate([]);
        setUserSubmissions([]);
        setEvaluatedPeerFirestoreIds(new Set());
    }

    if (fetchSuccess) {
        // Pass the onSetupComplete callback (which is refreshUI) to checkCompletionInternal
        // so it can be called again after summaries are fetched if completion status changes or requires it.
        await checkCompletionInternal(onSetupComplete);
    } else {
        // If fetches failed, ensure completion status reflects that (should be false from above)
        logDebugWarn("evaluationManager.setupEvaluationUI: Skipping checkCompletionInternal due to data fetch failure.");
        // The flag allEvaluationsDoneForCurrentUserInThisOpenPeriod is already false due to handleLogin or the catch block.
    }
        
    hideLoading();
}

/**
 * Loads the evaluation form for a specific peer.
 * This function will prepare the data and then rely on a UI rendering function (to be created)
 * to display the form.
 * @param {object} peerToEvaluate - The peer object to load the form for.
 * @param {Function} onFormReady - Callback to signal that the form can be displayed.
 * @param {Function} onError - Callback if there's an error loading the form.
 */
export function loadEvaluationForm(peerToEvaluate, onFormReady, onError) {
    const { categorizedQuestions, evaluatedPeerFirestoreIds } = getState();
    logDebug("evaluationManager.loadEvaluationForm for peer:", peerToEvaluate.name);

    if (evaluatedPeerFirestoreIds.has(peerToEvaluate.id)) {
        logDebug("Peer already evaluated, not loading form.");
        // Optionally, call onError or handle this case specifically if needed
        return; 
    }

    if (!categorizedQuestions || Object.keys(categorizedQuestions).length === 0) {
        logDebugError("evaluationManager.loadEvaluationForm: Questions not loaded.");
        showError("Evaluation questions are missing. Please refresh.", evaluationMessage);
        if (onError) onError("Questions not loaded");
        return;
    }

    // Set up data for the form
    if (evaluatingPeerName) evaluatingPeerName.textContent = `Evaluating: ${peerToEvaluate.name || 'Unknown Peer'}`;
    if (evaluationMessage) evaluationMessage.textContent = ''; // Clear previous messages
    
    // The actual rendering of the questions onto questionsForm will be done by a dedicated UI function.
    // For now, we just set the dataset on the submit button.
    if (submitEvaluationButton) {
        submitEvaluationButton.dataset.evaluatingPeerFirestoreId = peerToEvaluate.id;
        submitEvaluationButton.dataset.evaluatingPeerName = peerToEvaluate.name || '';
    }

    logDebug("evaluationManager.loadEvaluationForm: Ready to render form for", peerToEvaluate.name);
    if (onFormReady) onFormReady(peerToEvaluate, categorizedQuestions);
}

/**
 * Handles the submission of an evaluation.
 * - Collects scores from the form.
 * - Saves the evaluation and its summary to Firestore.
 * - Updates local state.
 * @param {Function} onSubmitComplete - Callback to refresh UI after submission.
 */
export async function handleSubmitEvaluation(onSubmitComplete) {
    showLoading();
    const { currentUserProfile, categorizedQuestions, userSubmissions, peersToEvaluate, currentEvaluationPeriodId } = getState();
    const evaluatedPeerId = submitEvaluationButton.dataset.evaluatingPeerFirestoreId;
    const evaluatedPeerDisplayName = submitEvaluationButton.dataset.evaluatingPeerName;

    if (!currentUserProfile || !currentUserProfile.id || !evaluatedPeerId) {
        showError('Error: User or peer information is missing.', evaluationMessage);
        hideLoading();
        if (onSubmitComplete) onSubmitComplete();
        return;
    }

    if (!categorizedQuestions || Object.keys(categorizedQuestions).length === 0) {
        logDebugError("evaluationManager.handleSubmitEvaluation: Questions not loaded.");
        showError('Cannot submit: Questions missing. Please refresh.', evaluationMessage);
        hideLoading();
        if (onSubmitComplete) onSubmitComplete();
        return;
    }

    const evaluatorName = currentUserProfile.name;
    const scores = {};
    let totalQuestionsInForm = 0;
    Object.values(categorizedQuestions).forEach(category => {
        if (category.questions) totalQuestionsInForm += category.questions.length;
    });

    // querySelectorAll should be scoped to the questionsForm for robustness
    const radioButtons = questionsForm.querySelectorAll('.likert-scale input[type="radio"]:checked');
    radioButtons.forEach(radio => {
        const questionId = radio.dataset.questionId;
        scores[questionId] = parseInt(radio.value, 10);
    });

    if (Object.keys(scores).length < totalQuestionsInForm) {
        showError('Please answer all questions before submitting.', evaluationMessage);
        hideLoading();
        // Do not call onSubmitComplete here as the UI state hasn't changed fundamentally for a refresh.
        return;
    }

    try {
        await firestoreService.submitEvaluation(
            currentUserProfile.id, evaluatedPeerId, scores,
            evaluatorName, evaluatedPeerDisplayName
        );

        // Update local state immediately for UI responsiveness
        const newEvaluatedIds = new Set(getState().evaluatedPeerFirestoreIds);
        newEvaluatedIds.add(evaluatedPeerId);
        setEvaluatedPeerFirestoreIds(newEvaluatedIds);

        const submissionData = {
            evaluatorId: currentUserProfile.id,
            evaluatorName,
            evaluatedPeerId,
            evaluatedPeerName: evaluatedPeerDisplayName,
            scores,
            submittedAt: new Date() // Client-side timestamp for immediate use
        };
        const updatedSubmissions = userSubmissions.filter(sub => sub.evaluatedPeerId !== evaluatedPeerId);
        updatedSubmissions.push(submissionData);
        setUserSubmissions(updatedSubmissions);

        logDebug("[handleSubmitEvaluation] Successfully updated local state for evaluated peer.");

        // Calculate and save summary
        logDebug("[handleSubmitEvaluation] About to call calculatePeerAveragesInternal.");
        const { categoryAverages, overallAverage } = calculatePeerAveragesInternal(
            evaluatedPeerId, 
            scores, 
            categorizedQuestions
        );
        logDebug("[handleSubmitEvaluation] Finished calculatePeerAveragesInternal. Overall: ", overallAverage, "CategoryAverages:", categoryAverages);

        const summaryDataToSave = {
            evaluatorId: currentUserProfile.id,
            evaluatorName: currentUserProfile.name,
            evaluatedPeerId: evaluatedPeerId,
            evaluatedPeerName: evaluatedPeerDisplayName,
            evaluationPeriodId: currentEvaluationPeriodId || "default",
            categoryAverages: categoryAverages,
            overallAverage: overallAverage,
            submissionTimestamp: new Date().toISOString()
        };

        logDebug("[handleSubmitEvaluation] Current Evaluation Period ID from state for summary:", currentEvaluationPeriodId);
        logDebug("[handleSubmitEvaluation] Data for saveSummarizedEvaluationToFirestore:", summaryDataToSave);
        
        // Validate data before saving
        for (const key in summaryDataToSave) {
            if (summaryDataToSave[key] === undefined) {
                logDebugError(`[handleSubmitEvaluation] UNDEFINED FIELD DETECTED in summaryDataToSave: ${key}`);
                showError(`Critical error: Data integrity issue (undefined field: ${key}). Please contact support.`, evaluationMessage);
                hideLoading();
                return; // Prevent saving undefined data
            }
        }
        // Deep check categoryAverages for undefined, if it's an object of objects
        if (summaryDataToSave.categoryAverages && typeof summaryDataToSave.categoryAverages === 'object') {
            for (const catId in summaryDataToSave.categoryAverages) {
                if (typeof summaryDataToSave.categoryAverages[catId] === 'object' && summaryDataToSave.categoryAverages[catId] !== null) {
                    for (const detailKey in summaryDataToSave.categoryAverages[catId]) {
                        if (summaryDataToSave.categoryAverages[catId][detailKey] === undefined) {
                             logDebugError(`[handleSubmitEvaluation] UNDEFINED FIELD DETECTED in categoryAverages[${catId}].${detailKey}`);
                             showError(`Critical error: Data integrity issue (undefined field in category: ${catId}.${detailKey}). Please contact support.`, evaluationMessage);
                             hideLoading();
                             return; // Prevent saving undefined data
                        }
                    }
                } else if (summaryDataToSave.categoryAverages[catId] === undefined) {
                    logDebugError(`[handleSubmitEvaluation] UNDEFINED FIELD DETECTED in categoryAverages[${catId}]`);
                    showError(`Critical error: Data integrity issue (undefined category: ${catId}). Please contact support.`, evaluationMessage);
                    hideLoading();
                    return; // Prevent saving undefined data
                }
            }
        }

        logDebug("[handleSubmitEvaluation] About to call saveSummarizedEvaluationToFirestore with validated data.");
        const summarySaveSuccess = await firestoreService.saveSummarizedEvaluation(summaryDataToSave);
        if (summarySaveSuccess) {
            logDebug("[handleSubmitEvaluation] Summary saved successfully.");
        } else {
            logDebugWarn("[handleSubmitEvaluation] Summary save was marked as unsuccessful by firestoreService.");
        }

        // Clear the form
        try {
            const uiRendererModule = await import('./uiRenderer.js');
            if (uiRendererModule && uiRendererModule.clearEvaluationForm) {
                uiRendererModule.clearEvaluationForm();
                logDebug("[handleSubmitEvaluation] Called uiRenderer.clearEvaluationForm().");
            }
        } catch (e) {
            logDebugWarn("[handleSubmitEvaluation] Could not load/call uiRenderer.clearEvaluationForm. Error: ", e.message, ". Falling back.");
            if (evaluationFormContainer) {
                evaluationFormContainer.style.display = 'none';
                logDebug("[handleSubmitEvaluation] Fallback: Hid evaluationFormContainer directly.");
            }
        }
        
        // THIS IS THE CRITICAL PART FOR UI REFRESH
        logDebug("[handleSubmitEvaluation] TRYING to call onSubmitComplete. Type: " + typeof onSubmitComplete);
        if (onSubmitComplete && typeof onSubmitComplete === 'function') {
            try {
                await onSubmitComplete(); 
                logDebug("[handleSubmitEvaluation] SUCCESSFULLY CALLED onSubmitComplete.");
            } catch (refreshError) {
                logDebugError("[handleSubmitEvaluation] Error during onSubmitComplete (refreshUI) execution:", refreshError);
            }
        } else {
            logDebugWarn("[handleSubmitEvaluation] onSubmitComplete was NOT a function or not provided! Type: " + typeof onSubmitComplete);
        }

        // Check completion status AFTER UI refresh has been initiated or attempted
        logDebug("[handleSubmitEvaluation] About to call checkCompletionInternal (after onSubmitComplete attempt).");
        await checkCompletionInternal(onSubmitComplete); 

        showSuccess("Evaluation submitted! Your insights are valuable.", evaluationMessage);
        logDebug("[handleSubmitEvaluation] Evaluation process complete for this peer.");

    } catch (error) {
        logDebugError("Error submitting evaluation in evaluationManager (outer try-catch):", error);
        showError(`Failed to submit evaluation: ${error.message}`, evaluationMessage);
        // Optionally, still try to refresh UI to clear form or show error state if appropriate
        logDebug("[handleSubmitEvaluation] In CATCH block, attempting to call onSubmitComplete if available. Type: " + typeof onSubmitComplete);
        if (onSubmitComplete && typeof onSubmitComplete === 'function') {
            try {
                await onSubmitComplete();
                logDebug("[handleSubmitEvaluation] Called onSubmitComplete from CATCH block.");
            } catch (refreshErrorFromCatch) {
                logDebugError("[handleSubmitEvaluation] Error during onSubmitComplete from CATCH block:", refreshErrorFromCatch);
            }
        }
    } finally {
        hideLoading();
        logDebug("[handleSubmitEvaluation] Exiting handleSubmitEvaluation.");
    }
}

/**
 * Internal function to check if all evaluations are complete for the current user.
 * Updates the `allEvaluationsDoneForCurrentUserInThisOpenPeriod` state.
 * This function does NOT trigger a UI refresh directly; that's the caller's responsibility.
 */
export async function checkCompletionInternal(onCompletionStatusChange = null) {
    const state = getState();
    const peersCount = state.peersToEvaluate ? state.peersToEvaluate.length : 0;
    const evaluatedCount = state.evaluatedPeerFirestoreIds ? state.evaluatedPeerFirestoreIds.size : 0;
    
    logDebug(`evaluationManager.checkCompletionInternal. Peers: ${peersCount} Evaluated: ${evaluatedCount} isOpen: ${state.isEvaluationOpen}`);
    
    let statusDidChange = false;
    const oldCompletionState = state.allEvaluationsDoneForCurrentUserInThisOpenPeriod;

    if (!state.isEvaluationOpen) {
        if (oldCompletionState) { // If it was complete but now closed, mark as incomplete for this UI context
            setAllEvaluationsDoneForCurrentUserInThisOpenPeriod(false);
            statusDidChange = true;
        }
        if (statusDidChange && typeof onCompletionStatusChange === 'function') {
            logDebug("evaluationManager.checkCompletionInternal: Evaluations closed, status changed, calling onCompletionStatusChange (no summaries).");
            onCompletionStatusChange(); // No summaries to pass if closed
        }
        return statusDidChange; 
    }

    const isNowComplete = (peersCount > 0 && evaluatedCount >= peersCount);
    
    if (isNowComplete && !oldCompletionState) {
        logDebug("evaluationManager.checkCompletionInternal: All evaluations now complete for current user.");
        setAllEvaluationsDoneForCurrentUserInThisOpenPeriod(true);
        statusDidChange = true;
        logDebug("evaluationManager.checkCompletionInternal: allEvaluationsDoneForCurrentUserInThisOpenPeriod changed to: true");
        
        if (state.currentUserProfile && state.currentUserProfile.id) {
            logDebug("evaluationManager.checkCompletionInternal: Fetching summarized evaluations for chart data because user just completed all.");
            try {
                const summaries = await firestoreService.fetchUserSummarizedEvaluations(state.currentUserProfile.id, state.currentEvaluationPeriodId);
                logDebug(`evaluationManager.checkCompletionInternal (fetch.then): Fetched ${summaries ? summaries.length : 'N/A'} summaries.`);
                setUserSummarizedEvaluations(summaries || []);
                if (typeof onCompletionStatusChange === 'function') {
                    logDebug("evaluationManager.checkCompletionInternal (fetch.then): About to call onCompletionStatusChange. summaries IS:", summaries, "Count:", summaries ? summaries.length : 'N/A');
                    onCompletionStatusChange(summaries || []);
                }
            } catch (error) {
                logDebugError("evaluationManager.checkCompletionInternal (fetch.catch): Error fetching summarized evaluations:", error);
                setUserSummarizedEvaluations([]);
                if (typeof onCompletionStatusChange === 'function') {
                    logDebug("evaluationManager.checkCompletionInternal (fetch.catch): About to call onCompletionStatusChange with empty summaries due to error.");
                    onCompletionStatusChange([]);
                }
            }
        } else if (typeof onCompletionStatusChange === 'function') {
            logDebug("evaluationManager.checkCompletionInternal: No user profile for summary fetch, but completion status changed. Calling onCompletionStatusChange (no summaries).");
            onCompletionStatusChange([]); // Pass empty array
        }
    } else if (!isNowComplete && oldCompletionState) {
        logDebug("evaluationManager.checkCompletionInternal: Evaluations no longer complete.");
        setAllEvaluationsDoneForCurrentUserInThisOpenPeriod(false);
        setUserSummarizedEvaluations([]); 
        statusDidChange = true;
        logDebug("evaluationManager.checkCompletionInternal: allEvaluationsDoneForCurrentUserInThisOpenPeriod changed to: false");
        if (typeof onCompletionStatusChange === 'function') {
            logDebug("evaluationManager.checkCompletionInternal: Completion status changed to false. Calling onCompletionStatusChange (empty summaries).");
            onCompletionStatusChange([]);
        }
    } else if (isNowComplete && oldCompletionState && typeof onCompletionStatusChange === 'function'){
        logDebug("evaluationManager.checkCompletionInternal: Was complete, still complete. Attempting to fetch summaries for consistency.");
        // Even if was complete and still complete, ensure we have fresh summaries to pass to the callback.
        // This handles the case where setupEvaluationUI might not have populated them before this specific path is taken.
        if (state.currentUserProfile && state.currentUserProfile.id) {
            // Fetch summaries to ensure consistency, even if theoretically already complete.
            try {
                const summaries = await firestoreService.fetchUserSummarizedEvaluations(state.currentUserProfile.id, state.currentEvaluationPeriodId);
                logDebug(`evaluationManager.checkCompletionInternal (isNowComplete && oldCompletionState branch.then): Fetched ${summaries ? summaries.length : 'N/A'} summaries.`);
                setUserSummarizedEvaluations(summaries || []);
                logDebug("evaluationManager.checkCompletionInternal (isNowComplete && oldCompletionState branch.then): About to call onCompletionStatusChange. summaries IS:", summaries, "Count:", summaries ? summaries.length : 'N/A');
                onCompletionStatusChange(summaries || []);
            } catch (error) {
                logDebugError("evaluationManager.checkCompletionInternal (isNowComplete && oldCompletionState branch.catch): Error fetching summaries:", error);
                setUserSummarizedEvaluations([]);
                logDebug("evaluationManager.checkCompletionInternal (isNowComplete && oldCompletionState branch.catch): About to call onCompletionStatusChange with empty summaries due to error.");
                onCompletionStatusChange([]);
            }
        } else {
             logDebug("evaluationManager.checkCompletionInternal (isNowComplete && oldCompletionState branch): No user profile for summary fetch. Calling onCompletionStatusChange with empty summaries.");
            onCompletionStatusChange([]); // No profile, pass empty array
        }
    } else if (typeof onCompletionStatusChange === 'function') {
        logDebug("evaluationManager.checkCompletionInternal: Fallback call to onCompletionStatusChange. Passing empty array as summaries are uncertain.");
        onCompletionStatusChange([]); // Pass empty array
    }
    
    return statusDidChange;
}

/**
 * Recalculates completion status and triggers a UI update. 
 * To be called when a UI refresh is needed after conditions might have changed (e.g., peer list update).
 * @param {Function} onUpdateNeeded - Callback to refresh the UI.
 */
export function checkCompletionAndRefresh(onUpdateNeeded) {
    checkCompletionInternal();
    if (onUpdateNeeded) onUpdateNeeded();
}


/**
 * Internal function to calculate average ratings for a peer based on provided scores and question structure.
 * @param {string} evaluatedPeerId - The ID of the peer whose scores are being averaged.
 * @param {object} scores - The scores object for the peer { questionId: score }.
 * @param {object} questionsData - The categorized questions structure.
 * @returns {object} { categoryAverages, overallAverage }
 */
function calculatePeerAveragesInternal(evaluatedPeerId, scores, questionsData) {
    logDebug("evaluationManager.calculatePeerAveragesInternal for peer:", evaluatedPeerId);

    if (!scores || Object.keys(scores).length === 0) {
        logDebug("No scores provided for this peer to calculatePeerAveragesInternal.");
        return { categoryAverages: {}, overallAverage: 0 };
    }

    const categoryAggregates = {}; // Use aggregates to avoid confusion with final averages object shape
    let totalScoreSum = 0;
    let totalQuestionsCount = 0;

    if (!questionsData || Object.keys(questionsData).length === 0) {
        logDebugWarn("evaluationManager.calculatePeerAveragesInternal: categorizedQuestions is empty. Calculating overall average only.");
        Object.values(scores).forEach(score => {
            if (typeof score === 'number' && Number.isFinite(score)) {
                totalScoreSum += score;
                totalQuestionsCount++;
            }
        });
        return {
            categoryAverages: {}, 
            overallAverage: totalQuestionsCount > 0 ? totalScoreSum / totalQuestionsCount : 0
        };
    }

    try {
        Object.entries(scores).forEach(([questionId, score]) => {
            if (typeof score !== 'number' || !Number.isFinite(score)) {
                logDebugWarn(`Invalid score for question ${questionId}:`, score);
                return; 
            }

            let foundCategoryInfo = null;
            Object.values(questionsData).forEach(category => {
                if (category.questions && category.questions.find(q => q.id === questionId)) {
                    foundCategoryInfo = category.categoryDetails;
                }
            });

            if (foundCategoryInfo && foundCategoryInfo.id) {
                if (!categoryAggregates[foundCategoryInfo.id]) {
                    categoryAggregates[foundCategoryInfo.id] = {
                        name: foundCategoryInfo.name || 'Unknown Category',
                        totalScore: 0,
                        count: 0
                    };
                }
                categoryAggregates[foundCategoryInfo.id].totalScore += score;
                categoryAggregates[foundCategoryInfo.id].count++;
            } else {
                logDebugWarn(`Question ID ${questionId} not found in current categories for averaging.`);
            }
            // Always contribute to overall average, even if category mapping is problematic
            totalScoreSum += score;
            totalQuestionsCount++;
        });

        const finalCategoryAverages = {};
        Object.entries(categoryAggregates).forEach(([catId, aggregate]) => {
            finalCategoryAverages[catId] = {
                name: aggregate.name,
                average: aggregate.count > 0 ? aggregate.totalScore / aggregate.count : 0
            };
        });
        
        const overallAverage = totalQuestionsCount > 0 ? totalScoreSum / totalQuestionsCount : 0;
        
        return {
            categoryAverages: finalCategoryAverages, // This is { catId: { name: 'X', average: N }}
            overallAverage
        };
    } catch (error) {
        logDebugError("Error in evaluationManager.calculatePeerAveragesInternal:", error);
        return { categoryAverages: {}, overallAverage: 0 };
    }
}

/**
 * Public-facing function to calculate peer averages using current state.
 * This is useful for on-demand calculations, e.g., for showing stats for an already evaluated peer.
 * @param {string} evaluatedPeerId - The ID of the peer.
 * @returns {object} { categoryAverages, overallAverage } or null if data is missing.
 */
export function calculateAndGetPeerAveragesFromState(evaluatedPeerId) {
    const { userSubmissions, categorizedQuestions } = getState();
    const submission = userSubmissions.find(sub => sub.evaluatedPeerId === evaluatedPeerId);

    if (!submission || !submission.scores) {
        logDebug("No submission/scores found in state for peer:", evaluatedPeerId);
        return null;
    }
    if (!categorizedQuestions || Object.keys(categorizedQuestions).length === 0) {
        logDebugWarn("Categorized questions not available in state for average calculation.");
        // Fallback to overall if only scores are present without question structure
        let totalScore = 0;
        let questionCount = 0;
        Object.values(submission.scores).forEach(s => {
            if (typeof s === 'number' && Number.isFinite(s)) {
                totalScore += s;
                questionCount++;
            }
        });
        return {
            categoryAverages: {},
            overallAverage: questionCount > 0 ? totalScore / questionCount : 0
        };
    }
    return calculatePeerAveragesInternal(evaluatedPeerId, submission.scores, categorizedQuestions);
}

/**
 * Resets the current user's evaluation progress for the current open session.
 * Allows the user to start evaluating peers again from the beginning.
 */
export function requestReEvaluation() {
    logDebug("evaluationManager.requestReEvaluation called.");
    const { isEvaluationOpen } = getState();

    if (!isEvaluationOpen) {
        logDebugWarn("evaluationManager.requestReEvaluation: Attempted re-evaluation when system is closed.");
        return false; 
    }

    // Only reset the completion flag. Do NOT clear evaluatedPeerFirestoreIds or userSubmissions here
    // if the goal is to allow users to see and potentially change their previous evaluations for the session.
    setAllEvaluationsDoneForCurrentUserInThisOpenPeriod(false);
    
    logDebug("evaluationManager.requestReEvaluation: User's completion flag reset for re-evaluation. Previous submissions for this session are retained locally.");
    return true; 
}

/**
 * Fills the currently displayed evaluation form with random scores.
 * This is intended for debug/testing purposes only.
 */
export function fillFormWithRandomScores() {
    if (!getState().isDebugMode) {
        logDebugWarn("fillFormWithRandomScores called when not in debug mode. Aborting.");
        return;
    }
    logDebug("fillFormWithRandomScores: Attempting to fill form with random scores.");

    if (!questionsForm) {
        logDebugError("fillFormWithRandomScores: questionsForm element not found.");
        return;
    }

    const questionsInForm = questionsForm.querySelectorAll('.question-item');
    if (questionsInForm.length === 0) {
        logDebugWarn("fillFormWithRandomScores: No questions found in the form to fill.");
        return;
    }

    questionsInForm.forEach((questionItem, index) => {
        const radioInputs = questionItem.querySelectorAll('input[type="radio"]');
        if (radioInputs.length > 0) {
            // Get a random score between 1 and 5 (or up to the number of radio buttons if less than 5 for some reason)
            const maxScore = Math.min(5, radioInputs.length);
            const randomScoreIndex = Math.floor(Math.random() * maxScore); // 0 to maxScore-1
            
            if (radioInputs[randomScoreIndex]) {
                radioInputs[randomScoreIndex].checked = true;
                logDebug(`Filled question ${index + 1} with score ${radioInputs[randomScoreIndex].value}`);
            }
        } else {
            logDebugWarn(`No radio inputs found for question ${index + 1}`);
        }
    });
    showSuccess("Form filled with random scores!", evaluationMessage);
}

// Functions like renderPeerList, updateUIBasedOnAppSettings, displayPeerEvaluationSummary, 
// createEvaluationChart, togglePeerStatsDropdown, populatePeerStats will be moved to 
// dedicated UI rendering/management modules (e.g., uiRenderer.js, uiOrchestrator.js) 
// and called by main.js as needed, using data from state.js.

// Similarly, event listeners for loginButton, userCodeInput, submitEvaluationButton
// will be set up in main.js and will call these exported manager functions. 