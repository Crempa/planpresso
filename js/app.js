// =====================
// Main application entry point
// =====================

import { appState } from './state.js';
import { clearOldStorage, loadFromURL, loadPlanFromStorage } from './storage.js';
import { validatePlan, showErrors } from './validation.js';
import { initMap, renderPlan } from './map.js';
import { VisualEditor } from './visual-editor.js';
import { initDOMElements, initAceEditors, setupEventHandlers, getElements } from './ui.js';
import { showModal, formatNights, parseNameWithEmoji, calculateNights } from './utils.js';

// Main initialization
function init() {
    // Delete old incompatible localStorage
    clearOldStorage();

    // Initialize DOM
    initDOMElements();

    // Initialize map
    initMap();

    // Initialize ACE editors
    initAceEditors();

    // Initialize Visual Editors
    VisualEditor.init('input', 'input');
    VisualEditor.init('editor', 'editor');

    // Setup event handlers
    setupEventHandlers();

    // Get element references
    const elements = getElements();

    // 1. Check URL parameters
    const urlPlan = loadFromURL();
    if (urlPlan) {
        const errors = validatePlan(urlPlan);
        if (errors.length === 0) {
            renderPlan(urlPlan);
            return;
        } else {
            // Invalid plan in URL - show modal with error
            appState.inputEditor.setValue(JSON.stringify(urlPlan, null, 2), -1);
            showErrors(errors, elements.errorSummary, elements.errorList, elements.jsonInputContainer);
            showModal(elements.inputModal);
            return;
        }
    }

    // 2. Check localStorage
    const savedPlan = loadPlanFromStorage();
    if (savedPlan) {
        const errors = validatePlan(savedPlan);
        if (errors.length === 0) {
            // Show recovery modal
            const parsed = parseNameWithEmoji(savedPlan.name);
            document.getElementById('recoveryName').textContent = parsed.name;
            const totalNights = savedPlan.stops.reduce((sum, s) => sum + calculateNights(s.dateFrom, s.dateTo), 0);
            document.getElementById('recoveryDetails').textContent =
                `${savedPlan.stops.length} zastávek, ${formatNights(totalNights)}`;
            showModal(elements.recoveryModal);
            return;
        }
    }

    // 3. Show input modal
    showModal(elements.inputModal);
}

// Start application
window.addEventListener('load', init);
