// =====================
// UI Event Handlers
// =====================

import { appState } from './state.js';
import { t } from './config.js';
import {
    showToast,
    showModal,
    hideModal,
    formatNights,
    calculateNights,
    parseNameWithEmoji,
    formatJsonInEditor
} from './utils.js';
import { getShareURL, loadPlanFromStorage, clearStorage } from './storage.js';
import { validatePlan, showErrors } from './validation.js';
import { renderPlan } from './map.js';
import { VisualEditor } from './visual-editor.js';

// DOM element references
let elements = {};

// Initialize DOM elements
export function initDOMElements() {
    elements = {
        sidebar: document.getElementById('sidebar'),
        inputModal: document.getElementById('inputModal'),
        recoveryModal: document.getElementById('recoveryModal'),
        editorModal: document.getElementById('editorModal'),
        toast: document.getElementById('toast'),
        jsonInputContainer: document.getElementById('jsonInputContainer'),
        editorJsonContainer: document.getElementById('editorJsonContainer'),
        errorSummary: document.getElementById('errorSummary'),
        errorList: document.getElementById('errorList'),
        editorErrorSummary: document.getElementById('editorErrorSummary'),
        editorErrorList: document.getElementById('editorErrorList'),
        dropZone: document.getElementById('dropZone'),
        fileInput: document.getElementById('fileInput'),
        mobileToggle: document.getElementById('mobileToggle'),
        exportDropdown: document.getElementById('exportDropdown'),
        controlsDropdown: document.getElementById('controlsDropdown'),
        aboutModal: document.getElementById('aboutModal')
    };
}

// Initialize Ace Editors
export function initAceEditors() {
    // Input editor
    appState.inputEditor = ace.edit("jsonInputContainer");
    appState.inputEditor.setTheme("ace/theme/tomorrow");
    appState.inputEditor.session.setMode("ace/mode/json");
    appState.inputEditor.setShowPrintMargin(false);
    appState.inputEditor.setOptions({
        fontSize: "13px",
        showLineNumbers: true,
        tabSize: 2,
        useSoftTabs: true,
        wrap: true
    });

    // Editor modal editor
    appState.editorEditor = ace.edit("editorJsonContainer");
    appState.editorEditor.setTheme("ace/theme/tomorrow");
    appState.editorEditor.session.setMode("ace/mode/json");
    appState.editorEditor.setShowPrintMargin(false);
    appState.editorEditor.setOptions({
        fontSize: "13px",
        showLineNumbers: true,
        tabSize: 2,
        useSoftTabs: true,
        wrap: true
    });
}

// Setup all event handlers
export function setupEventHandlers() {
    // Input modal
    document.getElementById('loadJsonBtn').addEventListener('click', () => {
        const plan = VisualEditor.getPlan('input');

        if (!plan) {
            showErrors([t('errors.invalidJson')], elements.errorSummary, elements.errorList, elements.jsonInputContainer);
            return;
        }

        const errors = validatePlan(plan);
        if (showErrors(errors, elements.errorSummary, elements.errorList, elements.jsonInputContainer)) {
            return;
        }

        VisualEditor.clearDraft('input');
        hideModal(elements.inputModal);
        renderPlan(plan);
    });

    document.getElementById('useExampleBtn').addEventListener('click', () => {
        const example = {
            name: "🏰 Víkend v Praze",
            stops: [
                { name: "Praha - Staré Město", lat: 50.0875, lng: 14.4214, dateFrom: "2025-03-01", dateTo: "2025-03-02" },
                { name: "Karlštejn", lat: 49.9394, lng: 14.1883, dateTo: "2025-03-02", notes: "Jednodenní výlet" },
                { name: "Praha - Letiště", lat: 50.1008, lng: 14.2600, dateFrom: "2025-03-02", dateTo: "2025-03-03" }
            ]
        };
        VisualEditor.clearDraft('input');
        hideModal(elements.inputModal);
        renderPlan(example);
    });

    // Toggle example
    document.getElementById('exampleToggle').addEventListener('click', () => {
        const exampleDiv = document.getElementById('exampleJson');
        const toggle = document.getElementById('exampleToggle');
        if (exampleDiv.style.display === 'none') {
            exampleDiv.style.display = 'block';
            toggle.textContent = 'Skrýt ukázkový JSON';
        } else {
            exampleDiv.style.display = 'none';
            toggle.textContent = 'Zobrazit ukázkový JSON';
        }
    });

    // Drag & drop
    elements.dropZone.addEventListener('click', () => elements.fileInput.click());

    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('dragover');
    });

    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('dragover');
    });

    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('dragover');

        const file = e.dataTransfer.files[0];
        if (file && (file.type === 'application/json' || file.name.endsWith('.json'))) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const plan = JSON.parse(ev.target.result);
                    // Load into visual editor
                    VisualEditor.loadPlan('input', plan);
                } catch (err) {
                    // On error load into ACE editor
                    appState.inputEditor.setValue(ev.target.result, -1);
                    formatJsonInEditor(appState.inputEditor);
                    VisualEditor.switchMode('input', 'code');
                }
            };
            reader.readAsText(file);
        }
    });

    elements.fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const plan = JSON.parse(ev.target.result);
                    // Load into visual editor
                    VisualEditor.loadPlan('input', plan);
                } catch (err) {
                    // On error load into ACE editor
                    appState.inputEditor.setValue(ev.target.result, -1);
                    formatJsonInEditor(appState.inputEditor);
                    VisualEditor.switchMode('input', 'code');
                }
            };
            reader.readAsText(file);
        }
    });

    // Auto-format on paste
    appState.inputEditor.on('paste', () => {
        setTimeout(() => formatJsonInEditor(appState.inputEditor), 10);
    });

    appState.editorEditor.on('paste', () => {
        setTimeout(() => formatJsonInEditor(appState.editorEditor), 10);
    });

    // Recovery modal
    document.getElementById('recoverBtn').addEventListener('click', () => {
        const plan = loadPlanFromStorage();
        hideModal(elements.recoveryModal);
        if (plan) {
            renderPlan(plan);
        } else {
            showModal(elements.inputModal);
        }
    });

    document.getElementById('startNewBtn').addEventListener('click', () => {
        clearStorage();
        hideModal(elements.recoveryModal);
        showModal(elements.inputModal);
    });

    // Action buttons
    document.getElementById('shareBtn').addEventListener('click', () => {
        const url = getShareURL(appState.currentPlan);
        if (url) {
            navigator.clipboard.writeText(url).then(() => {
                showToast(t('toast.copied'));
            });
        }
    });

    document.getElementById('editJsonBtn').addEventListener('click', () => {
        VisualEditor.loadPlan('editor', appState.currentPlan);
        elements.editorErrorSummary.classList.remove('visible');
        elements.editorJsonContainer.classList.remove('has-error');
        showModal(elements.editorModal);
    });

    // Export dropdown
    document.getElementById('exportBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        elements.exportDropdown.classList.toggle('open');
        elements.controlsDropdown.classList.remove('open');
    });

    // Controls dropdown
    document.getElementById('controlsBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        elements.controlsDropdown.classList.toggle('open');
        elements.exportDropdown.classList.remove('open');
    });

    // Prevent controls dropdown from closing on checkbox click
    elements.controlsDropdown.querySelector('.dropdown-content').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Close dropdowns on click outside
    document.addEventListener('click', (e) => {
        if (!elements.exportDropdown.contains(e.target)) {
            elements.exportDropdown.classList.remove('open');
        }
        if (!elements.controlsDropdown.contains(e.target)) {
            elements.controlsDropdown.classList.remove('open');
        }
    });

    // Export PNG - entire UI
    document.getElementById('exportPngBtn').addEventListener('click', async () => {
        elements.exportDropdown.classList.remove('open');
        showToast(t('toast.exportStarted'));

        // Wait for all tiles to load
        const mapEl = document.getElementById('map');
        await new Promise(resolve => {
            const checkTiles = () => {
                const tiles = mapEl.querySelectorAll('.leaflet-tile');
                const loading = Array.from(tiles).filter(t => !t.complete);
                if (loading.length === 0) resolve();
                else setTimeout(checkTiles, 100);
            };
            checkTiles();
        });

        // Short pause for rendering to complete
        await new Promise(r => setTimeout(r, 300));

        // Stop animations
        appState.leafletMap.stop();

        try {
            // Export entire container (map + sidebar)
            const container = document.querySelector('.container');
            const rect = container.getBoundingClientRect();

            const canvas = await html2canvas(container, {
                useCORS: true,
                allowTaint: false,
                backgroundColor: '#ffffff',
                scale: 1,
                width: rect.width,
                height: rect.height,
                scrollX: -window.scrollX,
                scrollY: -window.scrollY,
                windowWidth: document.documentElement.clientWidth,
                windowHeight: document.documentElement.clientHeight,
                ignoreElements: (el) => {
                    // Ignore dropdown, toast, modals
                    return el.classList.contains('dropdown-content') ||
                           el.classList.contains('toast') ||
                           el.classList.contains('modal-overlay') ||
                           el.classList.contains('mobile-toggle') ||
                           el.classList.contains('warning-message');
                }
            });

            const parsed = parseNameWithEmoji(appState.currentPlan?.name || 'mapa');
            const link = document.createElement('a');
            link.download = `${parsed.name}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            showToast(t('toast.exportDone'));
        } catch (err) {
            console.error(err);
            showToast(t('toast.exportFailed'));
        }
    });

    // Print
    document.getElementById('printBtn').addEventListener('click', () => {
        elements.exportDropdown.classList.remove('open');
        window.print();
    });

    // Editor modal
    document.getElementById('cancelEditBtn').addEventListener('click', () => {
        if (VisualEditor.hasUnsavedChanges('editor')) {
            if (!confirm('Máte neuložené změny. Opravdu chcete zavřít editor?')) {
                return;
            }
        }
        VisualEditor.clearDraft('editor');
        hideModal(elements.editorModal);
    });

    document.getElementById('copyJsonBtn').addEventListener('click', () => {
        // Get current JSON
        const plan = VisualEditor.getPlan('editor');
        const json = plan ? JSON.stringify(plan, null, 2) : appState.editorEditor.getValue();
        navigator.clipboard.writeText(json).then(() => {
            showToast(t('toast.jsonCopied'));
        });
    });

    document.getElementById('saveJsonBtn').addEventListener('click', () => {
        const plan = VisualEditor.getPlan('editor');

        if (!plan) {
            showErrors([t('errors.invalidJson')], elements.editorErrorSummary, elements.editorErrorList, elements.editorJsonContainer);
            return;
        }

        const errors = validatePlan(plan);
        if (showErrors(errors, elements.editorErrorSummary, elements.editorErrorList, elements.editorJsonContainer)) {
            return;
        }

        VisualEditor.clearDraft('editor');
        hideModal(elements.editorModal);
        renderPlan(plan);
        showToast(t('toast.saved'));
    });

    // Controls
    document.getElementById('showRoutes').addEventListener('change', function() {
        const line = appState.routeLine;
        if (this.checked) {
            if (line && !appState.leafletMap.hasLayer(line)) line.addTo(appState.leafletMap);
        } else {
            if (line && appState.leafletMap.hasLayer(line)) appState.leafletMap.removeLayer(line);
        }
    });

    document.getElementById('showLabels').addEventListener('change', function() {
        appState.labels.forEach(lbl => {
            if (this.checked) {
                if (!appState.leafletMap.hasLayer(lbl)) lbl.addTo(appState.leafletMap);
            } else {
                if (appState.leafletMap.hasLayer(lbl)) appState.leafletMap.removeLayer(lbl);
            }
        });
    });

    // Mobile toggle
    elements.mobileToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('visible');
        elements.mobileToggle.textContent = elements.sidebar.classList.contains('visible') ? 'Zobrazit mapu' : 'Zobrazit seznam';
    });

    // About modal
    document.getElementById('aboutBtn').addEventListener('click', () => {
        showModal(elements.aboutModal);
    });

    document.getElementById('closeAboutBtn').addEventListener('click', () => {
        hideModal(elements.aboutModal);
    });
}

// Get elements reference (for external use)
export function getElements() {
    return elements;
}
