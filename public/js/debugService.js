// import * as appState from './state.js'; // REMOVE THIS LINE

let internalIsDebugMode = false;

export function setDebugServiceMode(mode) {
    internalIsDebugMode = mode;
}

/**
 * Conditionally logs messages to the console if debug mode is enabled.
 * Prepends '[DEBUG]' to all messages.
 * @param {...any} args - Arguments to log, similar to console.log.
 */
export function logDebug(...args) {
    // if (appState.isDebugMode) { // OLD
    if (internalIsDebugMode) { // NEW
        console.log('[DEBUG]', ...args);
    }
}

/**
 * Conditionally logs warning messages to the console if debug mode is enabled.
 * Prepends '[DEBUG WARN]' to all messages.
 * @param {...any} args - Arguments to log, similar to console.warn.
 */
export function logDebugWarn(...args) {
    // if (appState.isDebugMode) { // OLD
    if (internalIsDebugMode) { // NEW
        console.warn('[DEBUG WARN]', ...args);
    } else {
        // Production warning logging (optional, could be just console.warn)
        console.warn(...args);
    }
}

/**
 * Conditionally logs error messages to the console if debug mode is enabled.
 * Prepends '[DEBUG ERROR]' to all messages.
 * @param {...any} args - Arguments to log, similar to console.error.
 */
export function logDebugError(...args) {
    // if (appState.isDebugMode) { // OLD
    if (internalIsDebugMode) { // NEW
        console.error('[DEBUG ERROR]', ...args);
    } else {
        // Production error logging
        console.error(...args);
    }
}

export function logInfo(...args) { // General info log, not debug-dependent
    console.info('[INFO]', ...args);
} 