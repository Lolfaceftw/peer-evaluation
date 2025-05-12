// UI Helper Functions
import {
    loadingOverlay,
    loginError as loginErrorElement, // Alias to avoid conflict if 'loginError' is used as var name
    evaluationMessage as evaluationMessageElement // Alias for clarity
} from './uiElements.js';

/**
 * Displays the loading overlay.
 */
export function showLoading() {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
    }
}

/**
 * Hides the loading overlay.
 */
export function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

/**
 * Displays an error message in a specified element (defaults to loginErrorElement).
 * @param {string} message - The error message to display.
 * @param {HTMLElement} [element=loginErrorElement] - The HTML element where the error should be shown.
 */
export function showError(message, element = loginErrorElement) {
    if (element) {
        element.textContent = message;
        element.className = 'error-message'; // Assuming you have CSS for this
    }
    hideLoading(); // Typically hide loading when an error occurs
}

/**
 * Displays a success message in a specified element (defaults to evaluationMessageElement).
 * @param {string} message - The success message to display.
 * @param {HTMLElement} [element=evaluationMessageElement] - The HTML element where the success message should be shown.
 */
export function showSuccess(message, element = evaluationMessageElement) {
    if (element) {
        element.textContent = message;
        element.className = 'success-message'; // Assuming you have CSS for this
    }
    hideLoading(); // Typically hide loading after a successful operation that showed loading
} 