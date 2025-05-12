import {
    loginSection,
    evaluationSection,
    completionSection,
    welcomeMessage,
    pendingEvaluationInstruction,
    primaryCompletionMessage,
    peerListContainer,
    evaluationFormContainer,
    evaluatingPeerName,
    questionsForm,
    evaluationMessage, // For messages within the form area
    peerEvaluationSummaryContainer,
    evaluationClosedMessage,
    statsVisualizationContainer,
    reEvaluateButton,
    // No need for loadingOverlay, loginError, submitEvalButton etc. here as they are handled by helpers or managers
} from './uiElements.js';
import { hideLoading, showError, showSuccess } from './uiHelpers.js'; // For specific messages if needed, though main display logic is here.
import { logDebug, logDebugWarn, logDebugError } from './debugService.js';
import { getState } from './state.js'; // Import getState
// Chart.js is expected to be loaded globally via a script tag in index.html for now.
// We'll hold the chart instance locally in this module.
let evaluationChartInstance = null;

/**
 * Renders the list of peers to evaluate.
 * @param {Array<object>} peers - List of peer objects { id, name, ... }.
 * @param {Set<string>} evaluatedPeerIds - Set of peer IDs that have been evaluated.
 * @param {boolean} isSystemOpen - Whether the evaluation system is currently open.
 * @param {Function} onPeerClick - Callback when a peer item is clicked: (peer) => {}.
 * @param {Function} onPeerStatsClick - Callback for stats icon: (event, peerId) => {}.
 */
export function renderPeerList(peers, evaluatedPeerIds, isSystemOpen, onPeerClick, onPeerStatsClick) {
    logDebug("uiRenderer.renderPeerList: Entry point. peerListContainer:", peerListContainer);
    logDebug("uiRenderer.renderPeerList. Peers count:", peers.length, "Evaluated IDs size:", evaluatedPeerIds.size);
    logDebug("uiRenderer.renderPeerList: received evaluatedPeerIds for rendering:", Array.from(evaluatedPeerIds));

    if (!peerListContainer) {
        logDebugError("uiRenderer.renderPeerList: peerListContainer is null or undefined. Aborting renderPeerList.");
        return;
    }

    logDebug("uiRenderer.renderPeerList: Received onPeerClick type:", typeof onPeerClick, "onPeerClick value:", onPeerClick);

    peerListContainer.innerHTML = ''; // Clear previous list

    if (peers.length === 0 && isSystemOpen) {
        peerListContainer.innerHTML = '<p>There are no other peers to evaluate in the system at this time.</p>';
        peerListContainer.style.display = 'block';
        return;
    }

    peers.forEach(peer => {
        const hasBeenEvaluated = evaluatedPeerIds.has(peer.id);

        const peerItem = document.createElement('div');
        peerItem.classList.add('peer-item');
        peerItem.dataset.peerFirestoreId = peer.id;

        // 1. Ellipsis Menu (if applicable)
        if (hasBeenEvaluated && onPeerStatsClick) { 
            const ellipsisMenuDiv = document.createElement('div');
            ellipsisMenuDiv.className = 'ellipsis-menu';
            const ellipsisButton = document.createElement('button');
            ellipsisButton.className = 'ellipsis-button';
            ellipsisButton.innerHTML = '&#8942;'; 
            ellipsisButton.title = `View stats for ${peer.name}`;
            ellipsisButton.addEventListener('click', (event) => {
                event.stopPropagation(); 
                onPeerStatsClick(event, peer.id);
            });
            ellipsisMenuDiv.appendChild(ellipsisButton);

            const dropdown = document.createElement('div');
            dropdown.className = 'dropdown-content';
            dropdown.id = `stats-dropdown-${peer.id}`;
            ellipsisMenuDiv.appendChild(dropdown);
            peerItem.appendChild(ellipsisMenuDiv); 
        }

        // 2. Peer Name
        const peerNameSpan = document.createElement('span');
        peerNameSpan.className = 'peer-name';
        peerNameSpan.textContent = peer.name || 'Unnamed Peer';
        peerItem.appendChild(peerNameSpan);

        // 3. Evaluated Status (if applicable)
        if (hasBeenEvaluated) {
            peerItem.classList.add('evaluated');
            const statusSpan = document.createElement('span');
            statusSpan.className = 'peer-status';
            statusSpan.textContent = '✔ Evaluated';
            peerItem.appendChild(statusSpan);
        } else if (isSystemOpen && onPeerClick) {
            // Logic for making item clickable if not evaluated and system is open
            if (typeof onPeerClick === 'function') {
                logDebug(`uiRenderer.renderPeerList: Attaching click listener for unevaluated peer ${peer.name || peer.id}`);
                peerItem.addEventListener('click', () => {
                    logDebug(`uiRenderer.renderPeerList: Peer item clicked: ${peer.name || peer.id}. Invoking onPeerClick.`);
                    onPeerClick(peer);
                });
            } else {
                logDebugWarn(`uiRenderer.renderPeerList: Attempted to attach click listener for unevaluated peer ${peer.name || peer.id}, but onPeerClick is not a function (type: ${typeof onPeerClick}). Listener NOT attached.`);
            }
        }

        peerListContainer.appendChild(peerItem);
    });
    peerListContainer.style.display = 'grid';
}

/**
 * Renders the evaluation form with categorized questions.
 * @param {object} peerToEvaluate - The peer being evaluated { id, name }.
 * @param {object} categorizedQuestionsData - Questions organized by category.
 */
export function renderEvaluationForm(peerToEvaluate, categorizedQuestionsData) {
    if (!questionsForm || !evaluatingPeerName || !evaluationFormContainer) return;

    // Clear previous content
    evaluatingPeerName.textContent = `Evaluating: ${peerToEvaluate.name || 'Unknown Peer'}`;
    questionsForm.innerHTML = ''; 
    if(evaluationMessage) evaluationMessage.textContent = '';

    // Clear and potentially add debug controls
    const debugControlsContainer = document.getElementById('debugControlsContainer');
    if (debugControlsContainer) {
        debugControlsContainer.innerHTML = ''; // Clear previous debug controls
        if (getState().isDebugMode) {
            logDebug("renderEvaluationForm: Debug mode is ON, adding debug controls.");
            const fillRandomButton = document.createElement('button');
            fillRandomButton.id = 'fillRandomScoresButton'; // Give it an ID for main.js to find
            fillRandomButton.textContent = 'Fill Random Scores';
            fillRandomButton.type = 'button'; // Important for forms, prevent default submit
            fillRandomButton.style.marginRight = '10px'; // Some basic styling
            debugControlsContainer.appendChild(fillRandomButton);
            // Event listener will be attached by main.js after form is rendered
        }
    }

    if (!categorizedQuestionsData || Object.keys(categorizedQuestionsData).length === 0) {
        showError("Failed to load evaluation questions. Data missing.", evaluationMessage);
        evaluationFormContainer.style.display = 'none';
        return;
    }

    const formContentContainer = document.createElement('div');
    formContentContainer.className = 'evaluation-categories-container';

    Object.values(categorizedQuestionsData).forEach(category => {
        if (!category || !category.categoryDetails || !category.questions) return;

        const categorySection = document.createElement('div');
        categorySection.className = 'category-section';

        const categoryHeader = document.createElement('h3');
        categoryHeader.textContent = `${category.categoryDetails.code}. ${category.categoryDetails.name}`;
        categorySection.appendChild(categoryHeader);

        const questionsListElement = document.createElement('ol');
        questionsListElement.className = 'questions-list';

        category.questions.forEach(question => {
            const questionItem = document.createElement('li');
            questionItem.className = 'question-item';

            const questionText = document.createElement('div');
            questionText.className = 'question-text';
            questionText.textContent = question.text;
            questionItem.appendChild(questionText);

            const likertDiv = document.createElement('div');
            likertDiv.className = 'likert-scale';
            for (let i = 1; i <= 5; i++) {
                const radioLabel = document.createElement('label');
                radioLabel.className = 'scale-option';
                const radioInput = document.createElement('input');
                radioInput.type = 'radio';
                radioInput.name = `question_${question.id}`; // Group radios for the same question
                radioInput.value = i;
                radioInput.id = `question_${question.id}_rating_${i}`;
                radioInput.dataset.questionId = question.id; // Store question ID for easier collection
                radioInput.required = true;
                radioLabel.appendChild(radioInput);
                radioLabel.appendChild(document.createTextNode(i.toString()));
                likertDiv.appendChild(radioLabel);
            }
            questionItem.appendChild(likertDiv);
            questionsListElement.appendChild(questionItem);
        });
        categorySection.appendChild(questionsListElement);
        formContentContainer.appendChild(categorySection);
    });

    questionsForm.appendChild(formContentContainer);
    evaluationFormContainer.style.display = 'block';
}

/**
 * Displays the peer evaluation summary table.
 * @param {Array<object>} summaries - Array of summarized evaluation data.
 */
export function displayPeerEvaluationSummary(summaries) {
    if (!peerEvaluationSummaryContainer) return;
    peerEvaluationSummaryContainer.innerHTML = ''; // Clear previous summary

    if (!summaries || summaries.length === 0) {
        peerEvaluationSummaryContainer.innerHTML = '<p>No evaluation summary data to display at this time.</p>';
        // Visibility is controlled by updateMainUI
        return;
    }

    const header = document.createElement('h2');
    header.textContent = 'Your Peer Evaluation Summary';
    peerEvaluationSummaryContainer.appendChild(header);

    const summaryTable = document.createElement('table');
    summaryTable.className = 'summary-table';
    const tableHeader = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const peerHeaderTh = document.createElement('th');
    peerHeaderTh.textContent = 'Peer Name';
    headerRow.appendChild(peerHeaderTh);

    // Dynamically create headers for categories from the first summary that has them
    const uniqueCategories = new Set();
    summaries.forEach(s => {
        if (s.categoryAverages) {
            Object.keys(s.categoryAverages).forEach(catName => uniqueCategories.add(catName));
        }
    });
    
    uniqueCategories.forEach(catName => {
        const th = document.createElement('th');
        th.textContent = catName;
        headerRow.appendChild(th);
    });

    const overallTh = document.createElement('th');
    overallTh.textContent = 'Overall';
    headerRow.appendChild(overallTh);
    tableHeader.appendChild(headerRow);
    summaryTable.appendChild(tableHeader);

    const tableBody = document.createElement('tbody');
    summaries.forEach(summary => {
        const row = document.createElement('tr');
        const nameCell = document.createElement('td');
        nameCell.textContent = summary.evaluatedPeerName || 'N/A';
        row.appendChild(nameCell);

        uniqueCategories.forEach(catName => {
            const cell = document.createElement('td');
            const avg = (summary.categoryAverages && summary.categoryAverages[catName] !== undefined) 
                        ? summary.categoryAverages[catName] 
                        : null;
            cell.textContent = (typeof avg === 'number') ? avg.toFixed(2) : '-';
            row.appendChild(cell);
        });
        
        const overallCell = document.createElement('td');
        overallCell.className = 'overall-score';
        overallCell.textContent = (typeof summary.overallAverage === 'number') ? summary.overallAverage.toFixed(2) : '-';
        row.appendChild(overallCell);
        tableBody.appendChild(row);
    });
    summaryTable.appendChild(tableBody);
    peerEvaluationSummaryContainer.appendChild(summaryTable);
}

/**
 * Creates or updates the evaluation chart.
 * @param {Array<object>} summaries - Array of summarized evaluation data.
 */
export function renderEvaluationChart(summaries) {
    logDebug("renderEvaluationChart: ENTERED. Summaries count: " + (summaries ? summaries.length : 'N/A'));

    if (!statsVisualizationContainer) {
        logDebugError("renderEvaluationChart: statsVisualizationContainer is null. Cannot render chart.");
        logDebug("renderEvaluationChart: EXITING due to missing statsVisualizationContainer.");
        return; // Should not happen if element exists
    }
    logDebug("renderEvaluationChart: statsVisualizationContainer FOUND.");
    const chartCanvas = document.getElementById('evaluationChart');
    if (!chartCanvas) {
        logDebugError("Chart canvas element (#evaluationChart) not found.");
        statsVisualizationContainer.style.display = 'none'; // Hide container if canvas is missing
        logDebug("renderEvaluationChart: EXITING due to missing chartCanvas.");
        return;
    }
    logDebug("renderEvaluationChart: chartCanvas FOUND.");

    // Add a version indicator for debugging
    const timestamp = new Date().toISOString();
    statsVisualizationContainer.dataset.renderTimestamp = timestamp;
    logDebug(`renderEvaluationChart: Rendering chart version ${timestamp}`);

    if (evaluationChartInstance) {
        evaluationChartInstance.destroy();
        evaluationChartInstance = null;
    }

    if (!summaries || !Array.isArray(summaries) || summaries.length === 0) {
        logDebug("uiRenderer.renderEvaluationChart: No valid summaries for chart.");
        statsVisualizationContainer.style.display = 'none'; // Hide if no data
        logDebug("renderEvaluationChart: EXITING due to no valid summaries.");
        return;
    }
    logDebug("renderEvaluationChart: Summaries are valid and non-empty.");

    const peerNames = [];
    const overallScores = [];
    const categoryDataSets = {}; // Store as { categoryName: [scores] }
    const allCategoryNames = new Set();

    summaries.forEach(summary => {
        if (summary.evaluatedPeerName) {
            peerNames.push(summary.evaluatedPeerName);
            overallScores.push(Number.isFinite(summary.overallAverage) ? summary.overallAverage : 0);
            if (summary.categoryAverages) {
                Object.keys(summary.categoryAverages).forEach(catName => {
                    allCategoryNames.add(catName);
                    if (!categoryDataSets[catName]) {
                        categoryDataSets[catName] = [];
                    }
                });
            }
        }
    });
    
    allCategoryNames.forEach(catName => {
        categoryDataSets[catName] = peerNames.map(name => {
            const summaryForPeer = summaries.find(s => s.evaluatedPeerName === name);
            if (summaryForPeer && summaryForPeer.categoryAverages && Number.isFinite(summaryForPeer.categoryAverages[catName])) {
                return summaryForPeer.categoryAverages[catName];
            }
            return 0; 
        });
    });

    if (peerNames.length === 0) {
        statsVisualizationContainer.style.display = 'none'; // Hide if no actual peers to chart
        logDebug("renderEvaluationChart: EXITING due to peerNames.length === 0.");
        return;
    }
    logDebug("renderEvaluationChart: peerNames populated. Count: " + peerNames.length);
    
    // If we have data and proceed to chart, ensure container is visible
    statsVisualizationContainer.style.display = 'block'; 
    const ctx = chartCanvas.getContext('2d');
    const datasets = [];
    const colorPalette = [
        'rgba(54, 162, 235, 0.7)', 'rgba(255, 99, 132, 0.7)',
        'rgba(75, 192, 192, 0.7)', 'rgba(255, 206, 86, 0.7)',
        'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)'
    ];
    let colorIndex = 0;

    datasets.push({
        label: 'Overall Average',
        data: overallScores,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderColor: 'rgba(0, 0, 0, 1)',
        borderWidth: 2,
        type: 'line',
        order: 0 
    });

    allCategoryNames.forEach(catName => {
        datasets.push({
            label: catName,
            data: categoryDataSets[catName],
            backgroundColor: colorPalette[colorIndex % colorPalette.length],
            borderColor: colorPalette[colorIndex % colorPalette.length].replace('0.7', '1'),
            borderWidth: 1,
            type: 'bar',
            order: 1
        });
        colorIndex++;
    });
    
    if (!Chart) {
        logDebugError("Chart.js library is not loaded.");
        statsVisualizationContainer.style.display = 'none'; // Hide if Chart.js is missing
        logDebug("renderEvaluationChart: EXITING due to Chart.js not loaded.");
        return;
    }
    logDebug("renderEvaluationChart: Chart.js library IS LOADED.");

    logDebug("renderEvaluationChart: About to create new Chart instance.");
    evaluationChartInstance = new Chart(ctx, {
        data: {
            labels: peerNames,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 5, title: { display: true, text: 'Average Score' } },
                x: { title: { display: true, text: 'Peers Evaluated' } }
            },
            plugins: {
                title: { display: true, text: 'Peer Evaluation Results', font: { size: 18 } },
                legend: { position: 'bottom', labels: { boxWidth: 12 } },
                tooltip: {
                    callbacks: {
                        title: (tooltipItems) => peerNames[tooltipItems[0].dataIndex],
                        label: (context) => `${context.dataset.label}: ${Number(context.raw).toFixed(2)}`
                    }
                }
            }
        }
    });
    logDebug("renderEvaluationChart: Chart instance CREATED. Container display: " + statsVisualizationContainer.style.display);
    logDebug("renderEvaluationChart: Chart rendered and container should be visible.");
}

/**
 * Toggles the visibility of a peer's stats dropdown and populates it.
 * @param {Event} event - The click event.
 * @param {string} peerId - The ID of the peer.
 * @param {Function} getPeerAveragesFn - Function to get averages: (peerId) => { categoryAverages, overallAverage }.
 */
export function togglePeerStatsDropdown(event, peerId, getPeerAveragesFn) {
    event.stopPropagation();
    // Close all other open dropdowns
    document.querySelectorAll('.dropdown-content.show').forEach(openDropdown => {
        if (openDropdown.id !== `stats-dropdown-${peerId}`) {
            openDropdown.classList.remove('show');
        }
    });

    const dropdown = document.getElementById(`stats-dropdown-${peerId}`);
    if (!dropdown) return;

    dropdown.classList.toggle('show');

    if (dropdown.classList.contains('show')) {
        if (typeof getPeerAveragesFn === 'function') {
            const averages = getPeerAveragesFn(peerId); // This should come from evaluationManager
            if (averages) {
                populatePeerStats(peerId, averages);
            } else {
                 dropdown.innerHTML = '<div class="stats-title">No stats available.</div>';
            }
        } else {
            dropdown.innerHTML = '<div class="stats-title">Stats calculation unavailable.</div>';
            logDebugWarn("togglePeerStatsDropdown: getPeerAveragesFn is not a function.");
        }
    }
}

/**
 * Populates the stats dropdown for a peer.
 * @param {string} peerId - The ID of the peer.
 * @param {object} averagesData - Object with { categoryAverages, overallAverage }.
 */
function populatePeerStats(peerId, averagesData) {
    const statsContentContainer = document.getElementById(`stats-dropdown-${peerId}`); // The dropdown itself is the container
    if (!statsContentContainer || !averagesData) {
        if (statsContentContainer) statsContentContainer.innerHTML = '<div class="stats-title">Error loading stats.</div>';
        return;
    }
    statsContentContainer.innerHTML = ''; // Clear previous

    const title = document.createElement('div');
    title.className = 'stats-title'; // A general class for styling
    title.textContent = 'Evaluation Statistics';
    statsContentContainer.appendChild(title);

    if (averagesData.categoryAverages && Object.keys(averagesData.categoryAverages).length > 0) {
        Object.values(averagesData.categoryAverages).forEach(category => {
             if (!category || typeof category.average !== 'number' || !category.name) return;
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'stat-category'; // General class for styling
            const categoryNameSpan = document.createElement('span');
            categoryNameSpan.className = 'category-name';
            categoryNameSpan.textContent = category.name;
            const categoryAvgSpan = document.createElement('span');
            categoryAvgSpan.className = 'category-average';
            categoryAvgSpan.textContent = `${Number(category.average).toFixed(1)} / 5.0`;
            categoryDiv.appendChild(categoryNameSpan);
            categoryDiv.appendChild(categoryAvgSpan);
            statsContentContainer.appendChild(categoryDiv);
        });
    } else {
        const noCategoriesDiv = document.createElement('div');
        noCategoriesDiv.className = 'stat-category';
        noCategoriesDiv.textContent = 'No category data available';
        statsContentContainer.appendChild(noCategoriesDiv);
    }

    const overallDiv = document.createElement('div');
    overallDiv.className = 'overall-average-stat'; // More specific class for styling
    const overallLabelSpan = document.createElement('span');
    overallLabelSpan.textContent = 'Overall:';
    const overallValueSpan = document.createElement('span');
    overallValueSpan.className = 'average-value';
    overallValueSpan.textContent = Number.isFinite(averagesData.overallAverage) ? `${Number(averagesData.overallAverage).toFixed(1)} / 5.0` : '0.0 / 5.0';
    overallDiv.appendChild(overallLabelSpan);
    overallDiv.appendChild(overallValueSpan);
    statsContentContainer.appendChild(overallDiv);
}

// Close dropdowns when clicking elsewhere on the page - main.js can set this up.
// export function setupGlobalClickListenerForDropdowns() { ... }

/**
 * Main function to update the entire UI based on the application state.
 * This function decides which sections to show/hide and what content to display.
 * @param {object} appState - The current state of the application from state.js.
 * @param {object} interactionCallbacks - Callbacks for UI interactions (onPeerClick, onPeerStatsClick, onSubmitEvaluation, onReEvaluate).
 */
export function updateMainUI(appState, interactionCallbacks) {
    // Log the received appState.summarizedEvaluations directly and its length
    logDebug("updateMainUI: ENTERED. appState.userSummarizedEvaluations IS:", appState.userSummarizedEvaluations);
    logDebug("updateMainUI: ENTERED. appState.userSummarizedEvaluations COUNT IS:", appState.userSummarizedEvaluations ? appState.userSummarizedEvaluations.length : 'N/A (or not an array)');
    
    const { 
        isUserLoggedIn,
        currentUserProfile,
        isEvaluationOpen,
        peersToEvaluate,
        evaluatedPeerFirestoreIds,
        currentEvaluationPeriodId,
        allEvaluationsDoneForCurrentUserInThisOpenPeriod,
        peerToEvaluate,
        categorizedQuestions,
        userSummarizedEvaluations,
        isLoading,
        clientJustProcessedGlobalReset
    } = appState;

    // Now, the log below should use the correctly destructured variable
    logDebug(`updateMainUI: Decision making state: currentUserProfile exists: ${!!currentUserProfile}, isEvaluationOpen: ${isEvaluationOpen}, allEvaluationsDoneForCurrentUserInThisOpenPeriod: ${allEvaluationsDoneForCurrentUserInThisOpenPeriod}, userSummarizedEvaluations count: ${userSummarizedEvaluations ? userSummarizedEvaluations.length : 'N/A'}`);

    // Always handle loading overlay first
    if (loadingOverlay) {
        loadingOverlay.style.display = isLoading ? 'flex' : 'none';
        if(isLoading) return; // If loading, don't try to render anything else
    }

    // Helper to hide multiple elements
    const hide = (...elements) => elements.forEach(el => el && (el.style.display = 'none'));
    // Helper to show multiple elements (defaulting to 'block', can be overridden)
    const show = (displayType = 'block', ...elements) => elements.forEach(el => el && (el.style.display = displayType));

    // Hide all major sections by default, then show based on state
    hide(
        loginSection, 
        evaluationSection, 
        welcomeMessage, 
        pendingEvaluationInstruction,
        peerListContainer, 
        evaluationFormContainer, 
        completionSection, 
        primaryCompletionMessage,
        peerEvaluationSummaryContainer, 
        statsVisualizationContainer, // Will be controlled by renderEvaluationChart or explicitly shown if no chart but other data
        evaluationClosedMessage,
        reEvaluateButton // Hide re-evaluate button initially, show it specifically in completion state
    );

    if (!currentUserProfile) {
        show('block', loginSection);
    } else {
        // User is logged in (currentUserProfile exists)
        show('block', evaluationSection); // Main container for logged-in users

        if (!isEvaluationOpen) {
            // STATE 3: EVALUATIONS CLOSED
            logDebug("updateMainUI: Evaluations CLOSED.");
            show('block', evaluationClosedMessage);
            // Still show summary and stats if they completed before closure
            if (allEvaluationsDoneForCurrentUserInThisOpenPeriod) {
                if (userSummarizedEvaluations && userSummarizedEvaluations.length > 0) {
                    displayPeerEvaluationSummary(userSummarizedEvaluations);
                    show('block', peerEvaluationSummaryContainer);
                    logDebug("updateMainUI: About to call renderEvaluationChart with summaries (State 3 - Closed/Done). Count:", userSummarizedEvaluations.length);
                    renderEvaluationChart(userSummarizedEvaluations);
                } else {
                     logDebug("updateMainUI: No summaries to display chart (State 3 - Closed/Done).");
                     if(statsVisualizationContainer) hide(statsVisualizationContainer); // Explicitly hide if no summaries for chart
                }
            }
        } else if (allEvaluationsDoneForCurrentUserInThisOpenPeriod) {
            // STATE 2: EVALUATIONS OPEN (or closed but user finished), ALL DONE BY USER
            logDebug("updateMainUI: Evaluations OPEN/DONE or CLOSED/DONE.");
            const userName = currentUserProfile ? currentUserProfile.name : 'Agent';
            if (primaryCompletionMessage) {
                primaryCompletionMessage.innerHTML = `<h2>Mission Accomplished, ${userName}!</h2><p>All squad members evaluated. Your intel is crucial! Thanks for the solid debrief!</p>`;
                show('block', primaryCompletionMessage);
                primaryCompletionMessage.className = 'message-banner success-message'; // Ensure correct class
            }

            if (completionSection) { // Show the original completion section for the re-evaluate button
                const h3 = completionSection.querySelector('h3');
                const p = completionSection.querySelector('p');
                if(h3) h3.style.display = 'none'; // Hide old "All evaluations complete!"
                if(p) p.style.display = 'none'; // Hide old "Thank you for participating."
                show('block', completionSection);
                if(reEvaluateButton) show('inline-block', reEvaluateButton); // Make sure button is visible
            }

            if (peersToEvaluate && peerListContainer) {
                logDebug("updateMainUI (STATE 2): About to call renderPeerList. isEvaluationOpen:", isEvaluationOpen, "peersToEvaluate count:", peersToEvaluate.length);
                renderPeerList(peersToEvaluate, evaluatedPeerFirestoreIds, isEvaluationOpen, interactionCallbacks.onPeerClick, interactionCallbacks.onPeerStatsClick);
                show('grid', peerListContainer); // Show peer list (items will be styled as evaluated)
            }
            if (userSummarizedEvaluations && userSummarizedEvaluations.length > 0) {
                displayPeerEvaluationSummary(userSummarizedEvaluations);
                show('block', peerEvaluationSummaryContainer);
                logDebug("updateMainUI: About to call renderEvaluationChart with summaries (State 2 - Open/Done). Count:", userSummarizedEvaluations.length);
                renderEvaluationChart(userSummarizedEvaluations);
            } else {
                logDebug("updateMainUI: No summaries to display chart (State 2 - Open/Done).");
                if(statsVisualizationContainer) hide(statsVisualizationContainer); // Explicitly hide if no summaries for chart
            }

        } else {
            // STATE 1: EVALUATIONS OPEN, NOT ALL DONE BY USER
            logDebug("updateMainUI: Evaluations OPEN, PENDING.");
            if (welcomeMessage && currentUserProfile) {
                welcomeMessage.textContent = `Welcome, ${currentUserProfile.name}! Ready to assess your squad?`;
                show('block', welcomeMessage);
            }
            if (pendingEvaluationInstruction) {
                show('block', pendingEvaluationInstruction);
            }
            if (peersToEvaluate && peerListContainer) {
                if (peersToEvaluate.length === 0) {
                    pendingEvaluationInstruction.innerHTML = '<p>No peers available to evaluate at this moment. Stand by, Agent!</p>';
                } else {
                     // Ensure original text if peers become available
                    pendingEvaluationInstruction.textContent = 'Please evaluate your peers. Click on a name to start.';
                }
                logDebug("updateMainUI (STATE 1): About to call renderPeerList. isEvaluationOpen:", isEvaluationOpen, "peersToEvaluate count:", peersToEvaluate.length);
                renderPeerList(peersToEvaluate, evaluatedPeerFirestoreIds, isEvaluationOpen, interactionCallbacks.onPeerClick, interactionCallbacks.onPeerStatsClick);
                show('grid', peerListContainer);
            } else if (peerListContainer) { // Handles case where peersToEvaluate might be null/undefined initially
                logDebug("updateMainUI (STATE 1): peersToEvaluate is falsy, showing 'Loading squad roster...'");
                peerListContainer.innerHTML = '<p>Loading squad roster...</p>';
                show('grid', peerListContainer);
            }

            if (peerToEvaluate && categorizedQuestions && evaluationFormContainer) {
                renderEvaluationForm(peerToEvaluate, categorizedQuestions);
                show('block', evaluationFormContainer);
            }
            if (statsVisualizationContainer) hide(statsVisualizationContainer); // Chart not shown in this state
        }
    }

    // Hide loading overlay explicitly if it wasn't returned early
    if (loadingOverlay && loadingOverlay.style.display !== 'none' && !isLoading) {
        hideLoading();
    }
    logDebug("updateMainUI: UI update finished.");
}

// Helper to clear the evaluation form if needed when navigating away or completing
export function clearEvaluationForm() {
    if (evaluationFormContainer) evaluationFormContainer.style.display = 'none';
    if (evaluatingPeerName) evaluatingPeerName.textContent = '';
    if (questionsForm) questionsForm.innerHTML = '';
    if (evaluationMessage) evaluationMessage.textContent = '';
}

// Global click listener for dropdowns - to be attached in main.js
export function setupGlobalClickListenerForDropdowns() {
    window.addEventListener('click', function(event) {
        // Check if the click is outside of any open dropdown menu and not on an ellipsis button
        if (!event.target.matches('.ellipsis-button')) {
            let clickedInsideDropdown = false;
            document.querySelectorAll('.dropdown-content.show').forEach(dropdown => {
                if (dropdown.contains(event.target)) {
                    clickedInsideDropdown = true;
                }
            });

            if (!clickedInsideDropdown) {
                document.querySelectorAll('.dropdown-content.show').forEach(dropdown => {
                    dropdown.classList.remove('show');
                });
            }
        }
    });
} 