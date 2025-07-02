
// =========================================================================
// State Management (The Store)
// =========================================================================

// The single source of truth for the application's data.
const state = {
    media: [],
    groups: [],
    assignments: [],
    materials: [],
    settings: {},
    available_sections: {}
};

// Listeners that will be called when the state changes.
const listeners = [];

/**
 * Subscribes a function to state changes.
 * @param {Function} listener - The function to call when the state updates.
 * @returns {Function} - A function to unsubscribe the listener.
 */
export function subscribe(listener) {
    listeners.push(listener);
    return function unsubscribe() {
        const index = listeners.indexOf(listener);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    };
}

/**
 * Updates the state and notifies all listeners.
 * This is the only way to modify the state.
 * @param {Partial<state>} newState - An object with the new state values to merge.
 */
export function setState(newState) {
    Object.assign(state, newState);
    console.log('State updated:', state);
    // Notify all subscribed listeners about the state change.
    listeners.forEach(listener => listener());
}

/**
 * Gets a snapshot of the current state.
 * @returns {state} The current state.
 */
export function getState() {
    return { ...state };
}
