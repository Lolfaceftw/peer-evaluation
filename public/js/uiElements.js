// DOM Element Selectors

/** Login section container. @type {HTMLElement | null} */
export const loginSection = document.getElementById('loginSection');

/** Input field for user code. @type {HTMLInputElement | null} */
export const userCodeInput = document.getElementById('userCodeInput');

/** Login button. @type {HTMLButtonElement | null} */
export const loginButton = document.getElementById('loginButton');

/** Element to display login errors. @type {HTMLElement | null} */
export const loginError = document.getElementById('loginError');

/** Main evaluation section container. @type {HTMLElement | null} */
export const evaluationSection = document.getElementById('evaluationSection');

/** Element to display welcome message. @type {HTMLElement | null} */
export const welcomeMessage = document.getElementById('welcomeMessage');

/** Paragraph element for instruction to evaluate peers. @type {HTMLElement | null} */
export const pendingEvaluationInstruction = document.getElementById('pendingEvaluationInstruction');

/** Container for the list of peers to evaluate. @type {HTMLElement | null} */
export const peerListContainer = document.getElementById('peerList');

/** Container for the evaluation form itself. @type {HTMLElement | null} */
export const evaluationFormContainer = document.getElementById('evaluationFormContainer');

/** Element displaying the name of the peer being evaluated. @type {HTMLElement | null} */
export const evaluatingPeerName = document.getElementById('evaluatingPeerName');

/** Form element containing the evaluation questions. @type {HTMLFormElement | null} */
export const questionsForm = document.getElementById('questionsForm');

/** Button to submit the evaluation. @type {HTMLButtonElement | null} */
export const submitEvaluationButton = document.getElementById('submitEvaluationButton');

/** Element to display messages related to evaluation submission (success/error). @type {HTMLElement | null} */
export const evaluationMessage = document.getElementById('evaluationMessage');

/** Section shown when all evaluations are complete. @type {HTMLElement | null} */
export const completionSection = document.getElementById('completionSection');

/** Loading overlay element. @type {HTMLElement | null} */
export const loadingOverlay = document.getElementById('loadingOverlay');

/** 
 * Container for the peer evaluation summary table. 
 * This element is created dynamically in the original script, so we ensure it exists or handle its creation carefully.
 * For now, assuming it's in the HTML or created by main.js early on.
 * @type {HTMLElement | null} 
 */
export let peerEvaluationSummaryContainer = document.getElementById('peerEvaluationSummary');

/** 
 * Message shown when evaluations are closed. 
 * This element is created dynamically in the original script.
 * @type {HTMLElement | null} 
 */
export let evaluationClosedMessage = document.getElementById('evaluationClosedMessage');

/** Container for the Chart.js visualization. @type {HTMLCanvasElement | null} */
export let statsVisualizationContainer = document.getElementById('statsVisualizationContainer');

/** Canvas element for the evaluation chart. @type {HTMLCanvasElement | null} */
export let evaluationChartCanvas = document.getElementById('evaluationChart');

/** Button to trigger re-evaluation from the completion screen. @type {HTMLButtonElement | null} */
export const reEvaluateButton = document.getElementById('reEvaluateButton');

/** Element for the primary consolidated completion message. @type {HTMLElement | null} */
export const primaryCompletionMessage = document.getElementById('primaryCompletionMessage');


// Dynamically created elements need to be handled slightly differently.
// The original script created these and appended them. 
// We'll assume they are either added to index.html or main.js will create and append them.
// If main.js creates them, it can then assign them to these exported variables if needed,
// or functions in ui.js can create them on demand.

/**
 * Function to initialize dynamically created elements if they are not in the HTML.
 * This should be called early in the application lifecycle, e.g., in main.js.
 */
export function initializeDynamicElements() {
    if (!peerEvaluationSummaryContainer) {
        peerEvaluationSummaryContainer = document.createElement('div');
        peerEvaluationSummaryContainer.id = 'peerEvaluationSummary';
        peerEvaluationSummaryContainer.className = 'peer-evaluation-summary';
        peerEvaluationSummaryContainer.style.display = 'none';
    }
    if (!evaluationClosedMessage) {
        evaluationClosedMessage = document.createElement('div');
        evaluationClosedMessage.id = 'evaluationClosedMessage';
        evaluationClosedMessage.className = 'evaluation-closed-message';
        evaluationClosedMessage.style.display = 'none';
        evaluationClosedMessage.innerHTML = '<h3>Peer Evaluations are currently closed</h3><p>The system is not accepting new evaluations at this time. Please check back later.</p>';
    }
    
    // Create statsVisualizationContainer if it doesn't exist
    if (!statsVisualizationContainer) {
        statsVisualizationContainer = document.createElement('div');
        statsVisualizationContainer.id = 'statsVisualizationContainer';
        statsVisualizationContainer.className = 'stats-visualization-container';
        statsVisualizationContainer.style.display = 'none';
        // Create and add the canvas element
        const canvas = document.createElement('canvas');
        canvas.id = 'evaluationChart';
        statsVisualizationContainer.appendChild(canvas);
        // Update the canvas reference too
        evaluationChartCanvas = canvas;
    }
}

/**
 * Appends dynamically created elements to the main container.
 * Assumes a .container element exists in index.html.
 * @param {HTMLElement} containerElement - The main container to append to.
 */
export function appendDynamicElementsToContainer(containerElement) {
    if (containerElement) {
        if (peerEvaluationSummaryContainer && !peerEvaluationSummaryContainer.parentElement) {
            containerElement.appendChild(peerEvaluationSummaryContainer);
        }
        if (evaluationClosedMessage && !evaluationClosedMessage.parentElement) {
            containerElement.appendChild(evaluationClosedMessage);
        }
    } else {
        console.error("Main container not found for appending dynamic elements.");
    }
} 