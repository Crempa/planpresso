// =====================
// Visual Editor Module
// =====================

import { appState } from './state.js';
import { MapPicker } from './map-picker.js';
import { showToast } from './utils.js';

export const VisualEditor = (function() {
    // State
    let currentMode = { input: 'visual', editor: 'visual' };
    let undoStack = { input: [], editor: [] };
    let redoStack = { input: [], editor: [] };
    let lastSyncedData = { input: null, editor: null };
    let customFields = { input: {}, editor: {} }; // Store unknown JSON fields
    let draftKey = 'planpresso-draft-v1';
    let syncTimeout = null;
    let draggedItem = null;

    // DOM elements (set during init)
    const elements = {
        input: {},
        editor: {}
    };

    // Debounce helper
    function debounce(fn, delay) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // Escape HTML - using DOMPurify (sanitization)
    function escapeHtml(text) {
        if (!text) return '';
        return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
    }

    // Format date for input[type=date]
    function formatDateForInput(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
    }

    // Parse markdown - using marked + DOMPurify
    function parseMarkdown(text) {
        if (!text) return '';
        const html = marked.parse(text, { breaks: true });
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['strong', 'em', 'a', 'ul', 'ol', 'li', 'p', 'br'],
            ALLOWED_ATTR: ['href', 'target']
        });
    }

    // Calculate nights - using date-fns
    function calcNights(from, to) {
        if (!from || !to) return 0;
        const f = new Date(from);
        const t = new Date(to);
        if (isNaN(f.getTime()) || isNaN(t.getTime())) return 0;
        return Math.max(0, dateFns.differenceInDays(t, f));
    }

    // Format date range short - using date-fns
    function formatDateShort(from, to) {
        if (!from && !to) return '';
        const csLocale = dateFns.locale.cs;
        if (from && to) {
            return `${dateFns.format(new Date(from), 'd. MMM', { locale: csLocale })} – ${dateFns.format(new Date(to), 'd. MMM', { locale: csLocale })}`;
        }
        return dateFns.format(new Date(from || to), 'd. MMM', { locale: csLocale });
    }

    // Check if stop is complete (has required fields)
    function isStopComplete(stop) {
        return stop.name && stop.lat != null && stop.lng != null && !isNaN(stop.lat) && !isNaN(stop.lng);
    }

    // Get visual data from form
    function getVisualData(ctx) {
        const el = elements[ctx];
        const stops = [];

        el.stopsList.querySelectorAll('.stop-item').forEach(item => {
            const stop = {
                name: item.querySelector('.stop-name')?.value.trim() || '',
                lat: parseFloat(item.querySelector('.stop-lat')?.value) || null,
                lng: parseFloat(item.querySelector('.stop-lng')?.value) || null
            };

            const label = item.querySelector('.stop-label')?.value.trim();
            const dateFrom = item.querySelector('.stop-dateFrom')?.value;
            const dateTo = item.querySelector('.stop-dateTo')?.value;
            const notes = item.querySelector('.stop-notes')?.value.trim();
            const imageUrl = item.querySelector('.stop-imageUrl')?.value.trim();

            if (label) stop.label = label;
            if (dateFrom) stop.dateFrom = dateFrom;
            if (dateTo) stop.dateTo = dateTo;
            if (notes) stop.notes = notes;
            if (imageUrl) stop.imageUrl = imageUrl;

            // Restore custom fields for this stop
            const idx = parseInt(item.dataset.stopIndex);
            if (customFields[ctx][idx]) {
                Object.assign(stop, customFields[ctx][idx]);
            }

            stops.push(stop);
        });

        const plan = {
            name: el.planName?.value.trim() || '',
            stops: stops
        };

        const dateFrom = el.planDateFrom?.value;
        const dateTo = el.planDateTo?.value;
        if (dateFrom) plan.dateFrom = dateFrom;
        if (dateTo) plan.dateTo = dateTo;

        return plan;
    }

    // Set visual data to form
    function setVisualData(ctx, plan) {
        const el = elements[ctx];
        if (!el.planName) return;

        // Reset custom fields storage
        customFields[ctx] = {};

        // Set plan metadata
        el.planName.value = plan.name || '';
        el.planDateFrom.value = formatDateForInput(plan.dateFrom);
        el.planDateTo.value = formatDateForInput(plan.dateTo);

        // Clear stops list
        el.stopsList.innerHTML = '';

        if (plan.stops && plan.stops.length > 0) {
            plan.stops.forEach((stop, index) => {
                // Store unknown fields
                const knownFields = ['name', 'lat', 'lng', 'label', 'dateFrom', 'dateTo', 'notes', 'imageUrl'];
                const custom = {};
                Object.keys(stop).forEach(key => {
                    if (!knownFields.includes(key)) {
                        custom[key] = stop[key];
                    }
                });
                if (Object.keys(custom).length > 0) {
                    customFields[ctx][index] = custom;
                }

                addStopItem(ctx, stop, index, false);
            });
        } else {
            renderEmptyState(ctx);
        }

        updateStats(ctx);
        updateStopNumbers(ctx);
    }

    // Sync visual to code
    function syncVisualToCode(ctx) {
        const plan = getVisualData(ctx);
        const editor = ctx === 'input' ? appState.inputEditor : appState.editorEditor;
        const json = JSON.stringify(plan, null, 2);
        editor.setValue(json, -1);
        lastSyncedData[ctx] = json;
    }

    // Sync code to visual
    function syncCodeToVisual(ctx) {
        const editor = ctx === 'input' ? appState.inputEditor : appState.editorEditor;
        try {
            const plan = JSON.parse(editor.getValue());
            setVisualData(ctx, plan);
            lastSyncedData[ctx] = editor.getValue();
            return true;
        } catch (e) {
            return false;
        }
    }

    // Debounced sync
    const debouncedSync = debounce(function(ctx) {
        syncVisualToCode(ctx);
        saveDraft(ctx);
    }, 500);

    // Save undo state
    function saveUndoState(ctx) {
        const data = JSON.stringify(getVisualData(ctx));
        if (undoStack[ctx].length === 0 || undoStack[ctx][undoStack[ctx].length - 1] !== data) {
            undoStack[ctx].push(data);
            if (undoStack[ctx].length > 50) undoStack[ctx].shift();
            redoStack[ctx] = [];
        }
    }

    // Undo
    function undo(ctx) {
        if (undoStack[ctx].length > 1) {
            redoStack[ctx].push(undoStack[ctx].pop());
            const data = JSON.parse(undoStack[ctx][undoStack[ctx].length - 1]);
            setVisualData(ctx, data);
            syncVisualToCode(ctx);
        }
    }

    // Redo
    function redo(ctx) {
        if (redoStack[ctx].length > 0) {
            const data = JSON.parse(redoStack[ctx].pop());
            undoStack[ctx].push(JSON.stringify(data));
            setVisualData(ctx, data);
            syncVisualToCode(ctx);
        }
    }

    // Clear undo history
    function clearUndoHistory(ctx) {
        undoStack[ctx] = [];
        redoStack[ctx] = [];
    }

    // Save draft to localStorage
    function saveDraft(ctx) {
        try {
            const data = getVisualData(ctx);
            localStorage.setItem(`${draftKey}-${ctx}`, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) { }
    }

    // Load draft from localStorage
    function loadDraft(ctx) {
        try {
            const saved = localStorage.getItem(`${draftKey}-${ctx}`);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) { }
        return null;
    }

    // Clear draft
    function clearDraft(ctx) {
        try {
            localStorage.removeItem(`${draftKey}-${ctx}`);
        } catch (e) { }
    }

    // Check for unsaved changes
    function hasUnsavedChanges(ctx) {
        const current = JSON.stringify(getVisualData(ctx));
        return current !== lastSyncedData[ctx];
    }

    // Update statistics
    function updateStats(ctx) {
        const el = elements[ctx];
        if (!el.statsStops || !el.statsNights) return;

        const stops = el.stopsList.querySelectorAll('.stop-item');
        let totalNights = 0;

        stops.forEach(item => {
            const from = item.querySelector('.stop-dateFrom')?.value;
            const to = item.querySelector('.stop-dateTo')?.value;
            totalNights += calcNights(from, to);
        });

        el.statsStops.textContent = stops.length;
        el.statsNights.textContent = totalNights;
    }

    // Update stop numbers
    function updateStopNumbers(ctx) {
        const el = elements[ctx];
        el.stopsList.querySelectorAll('.stop-item').forEach((item, idx) => {
            item.dataset.stopIndex = idx;
            const num = item.querySelector('.stop-item-number');
            if (num) num.textContent = idx + 1;
        });
    }

    // Create stop item HTML
    function createStopItemHTML(stop, index) {
        const title = stop.name || stop.label || 'Nová zastávka';
        const isEmpty = !stop.name;
        const dates = formatDateShort(stop.dateFrom, stop.dateTo);
        const nights = calcNights(stop.dateFrom, stop.dateTo);
        const complete = isStopComplete(stop);

        return `
            <div class="stop-item" data-stop-index="${index}" draggable="true">
                <div class="stop-item-header">
                    <div class="stop-item-drag-handle">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="8" y1="6" x2="16" y2="6"></line>
                            <line x1="8" y1="12" x2="16" y2="12"></line>
                            <line x1="8" y1="18" x2="16" y2="18"></line>
                        </svg>
                    </div>
                    <div class="stop-item-reorder">
                        <button type="button" class="stop-item-btn move-up" title="Posunout nahoru">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="18 15 12 9 6 15"></polyline>
                            </svg>
                        </button>
                        <button type="button" class="stop-item-btn move-down" title="Posunout dolů">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                    </div>
                    <span class="stop-item-number">${index + 1}</span>
                    <div class="stop-item-info">
                        <div class="stop-item-title ${isEmpty ? 'empty' : ''}">${escapeHtml(title)}</div>
                        ${dates ? `<div class="stop-item-subtitle">${dates}${nights > 0 ? ` · ${nights} ${nights === 1 ? 'noc' : nights < 5 ? 'noci' : 'nocí'}` : ''}</div>` : ''}
                    </div>
                    <div class="stop-item-status ${complete ? 'complete' : 'incomplete'}" title="${complete ? 'Kompletní' : 'Chybí povinná pole'}"></div>
                    <div class="stop-item-actions">
                        <button type="button" class="stop-item-btn duplicate" title="Duplikovat">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                        </button>
                        <button type="button" class="stop-item-btn delete" title="Smazat">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                        <button type="button" class="stop-item-btn stop-item-toggle" aria-expanded="false">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="stop-item-content" hidden>
                    <div class="form-group">
                        <label>Název *</label>
                        <input type="text" class="form-input stop-name" placeholder="např. Praha - Staré Město" value="${escapeHtml(stop.name || '')}">
                    </div>
                    <div class="form-group">
                        <label>Zkrácený popisek</label>
                        <input type="text" class="form-input stop-label" placeholder="např. Praha" value="${escapeHtml(stop.label || '')}">
                    </div>
                    <div class="coords-row">
                        <div class="form-group">
                            <label>Zeměpisná šířka *</label>
                            <input type="number" class="form-input stop-lat" step="any" placeholder="např. 50.0875" value="${stop.lat ?? ''}">
                        </div>
                        <div class="form-group">
                            <label>Zeměpisná délka *</label>
                            <input type="number" class="form-input stop-lng" step="any" placeholder="např. 14.4214" value="${stop.lng ?? ''}">
                        </div>
                        <button type="button" class="btn-map-picker" title="Vybrat na mapě">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                        </button>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Datum od</label>
                            <input type="date" class="form-input stop-dateFrom" value="${formatDateForInput(stop.dateFrom)}">
                        </div>
                        <div class="form-group">
                            <label>Datum do</label>
                            <input type="date" class="form-input stop-dateTo" value="${formatDateForInput(stop.dateTo)}">
                        </div>
                    </div>
                    <div class="form-group">
                        <div class="notes-header">
                            <label>Poznámky</label>
                            <button type="button" class="btn-preview-toggle">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                                Náhled
                            </button>
                        </div>
                        <textarea class="form-input form-textarea stop-notes" rows="2" placeholder="Volitelné poznámky (podporuje Markdown)">${escapeHtml(stop.notes || '')}</textarea>
                        <div class="markdown-preview" style="display: none;"></div>
                    </div>
                    <div class="form-group">
                        <label>URL obrázku</label>
                        <input type="text" class="form-input stop-imageUrl" placeholder="https://..." value="${escapeHtml(stop.imageUrl || '')}">
                    </div>
                </div>
            </div>
        `;
    }

    // Add stop item
    function addStopItem(ctx, stop = {}, index = null, expand = true) {
        const el = elements[ctx];

        // Remove empty state
        const emptyState = el.stopsList.querySelector('.stops-list-empty');
        if (emptyState) emptyState.remove();

        if (index === null) {
            index = el.stopsList.querySelectorAll('.stop-item').length;
        }

        const template = document.createElement('template');
        template.innerHTML = createStopItemHTML(stop, index);
        const item = template.content.firstElementChild;

        el.stopsList.appendChild(item);
        setupStopItemEvents(ctx, item);

        if (expand && !stop.name) {
            toggleStopItem(item, true);
            setTimeout(() => item.querySelector('.stop-name')?.focus(), 50);
        }

        updateStopNumbers(ctx);
        updateStats(ctx);

        return item;
    }

    // Remove stop item
    function removeStopItem(ctx, item) {
        saveUndoState(ctx);
        item.remove();

        const el = elements[ctx];
        if (el.stopsList.querySelectorAll('.stop-item').length === 0) {
            renderEmptyState(ctx);
        }

        updateStopNumbers(ctx);
        updateStats(ctx);
        debouncedSync(ctx);
    }

    // Duplicate stop item
    function duplicateStopItem(ctx, item) {
        saveUndoState(ctx);

        const stop = {
            name: item.querySelector('.stop-name')?.value || '',
            label: item.querySelector('.stop-label')?.value || '',
            lat: parseFloat(item.querySelector('.stop-lat')?.value) || null,
            lng: parseFloat(item.querySelector('.stop-lng')?.value) || null,
            dateFrom: item.querySelector('.stop-dateFrom')?.value || '',
            dateTo: item.querySelector('.stop-dateTo')?.value || '',
            notes: item.querySelector('.stop-notes')?.value || '',
            imageUrl: item.querySelector('.stop-imageUrl')?.value || ''
        };

        // Clean empty values
        Object.keys(stop).forEach(key => {
            if (stop[key] === '' || stop[key] === null) delete stop[key];
        });

        const newItem = addStopItem(ctx, stop, null, true);
        item.after(newItem);
        updateStopNumbers(ctx);
        debouncedSync(ctx);
    }

    // Toggle stop item accordion
    function toggleStopItem(item, forceExpand = null) {
        const content = item.querySelector('.stop-item-content');
        const toggle = item.querySelector('.stop-item-toggle');
        const isExpanded = !content.hidden;

        const shouldExpand = forceExpand !== null ? forceExpand : !isExpanded;

        if (shouldExpand) {
            content.hidden = false;
            item.classList.add('expanded');
            toggle?.setAttribute('aria-expanded', 'true');
        } else {
            content.hidden = true;
            item.classList.remove('expanded');
            toggle?.setAttribute('aria-expanded', 'false');
        }
    }

    // Render empty state
    function renderEmptyState(ctx) {
        const el = elements[ctx];
        el.stopsList.innerHTML = `
            <div class="stops-list-empty">
                Žádné zastávky. Klikněte na "Přidat zastávku" pro začátek.
            </div>
        `;
    }

    // Move stop (reorder)
    function moveStop(ctx, fromIndex, toIndex, dateAction = 'none') {
        const el = elements[ctx];
        const items = Array.from(el.stopsList.querySelectorAll('.stop-item'));

        if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) {
            return;
        }

        saveUndoState(ctx);

        const item = items[fromIndex];

        if (toIndex < fromIndex) {
            items[toIndex].before(item);
        } else {
            items[toIndex].after(item);
        }

        // Handle date adjustment if needed
        if (dateAction === 'shift') {
            adjustDatesAfterReorder(ctx);
        } else if (dateAction === 'fix') {
            fixDateOverlaps(ctx);
        }

        updateStopNumbers(ctx);
        debouncedSync(ctx);
    }

    // Adjust dates after reorder (shift relatively)
    function adjustDatesAfterReorder(ctx) {
        const el = elements[ctx];
        const items = Array.from(el.stopsList.querySelectorAll('.stop-item'));
        let prevDateTo = null;

        items.forEach(item => {
            const fromInput = item.querySelector('.stop-dateFrom');
            const toInput = item.querySelector('.stop-dateTo');

            if (prevDateTo && fromInput?.value) {
                const from = new Date(fromInput.value);
                const to = toInput?.value ? new Date(toInput.value) : null;
                const duration = to ? calcNights(fromInput.value, toInput.value) : 0;

                // Set new from date to day after previous to
                const newFrom = new Date(prevDateTo);
                newFrom.setDate(newFrom.getDate());
                fromInput.value = newFrom.toISOString().split('T')[0];

                if (to && duration > 0) {
                    const newTo = new Date(newFrom);
                    newTo.setDate(newTo.getDate() + duration);
                    toInput.value = newTo.toISOString().split('T')[0];
                }
            }

            if (toInput?.value) {
                prevDateTo = new Date(toInput.value);
            }
        });
    }

    // Fix date overlaps only
    function fixDateOverlaps(ctx) {
        const el = elements[ctx];
        const items = Array.from(el.stopsList.querySelectorAll('.stop-item'));
        let prevDateTo = null;

        items.forEach(item => {
            const fromInput = item.querySelector('.stop-dateFrom');
            const toInput = item.querySelector('.stop-dateTo');

            if (prevDateTo && fromInput?.value) {
                const from = new Date(fromInput.value);
                if (from < prevDateTo) {
                    fromInput.value = prevDateTo.toISOString().split('T')[0];
                }
            }

            if (toInput?.value) {
                prevDateTo = new Date(toInput.value);
            }
        });
    }

    // Show reorder dialog
    function showReorderDialog(ctx, fromIndex, toIndex) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('reorderDialogOverlay');
            if (!overlay) {
                resolve('none');
                return;
            }

            overlay.classList.add('visible');

            const handleOption = (action) => {
                overlay.classList.remove('visible');
                overlay.querySelectorAll('.reorder-dialog-option').forEach(btn => {
                    btn.removeEventListener('click', btn._handler);
                });
                resolve(action);
            };

            overlay.querySelectorAll('.reorder-dialog-option').forEach(btn => {
                btn._handler = () => handleOption(btn.dataset.action);
                btn.addEventListener('click', btn._handler);
            });
        });
    }

    // Setup stop item events
    function setupStopItemEvents(ctx, item) {
        // Header click (toggle)
        item.querySelector('.stop-item-header').addEventListener('click', (e) => {
            if (e.target.closest('.stop-item-btn') || e.target.closest('.stop-item-drag-handle') || e.target.closest('.stop-item-reorder')) {
                return;
            }
            toggleStopItem(item);
        });

        // Delete button
        item.querySelector('.stop-item-btn.delete')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Opravdu chcete smazat tuto zastávku?')) {
                removeStopItem(ctx, item);
            }
        });

        // Duplicate button
        item.querySelector('.stop-item-btn.duplicate')?.addEventListener('click', (e) => {
            e.stopPropagation();
            duplicateStopItem(ctx, item);
        });

        // Move up/down buttons
        item.querySelector('.move-up')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(item.dataset.stopIndex);
            if (idx > 0) {
                showReorderDialog(ctx, idx, idx - 1).then(action => {
                    moveStop(ctx, idx, idx - 1, action);
                });
            }
        });

        item.querySelector('.move-down')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(item.dataset.stopIndex);
            const el = elements[ctx];
            const count = el.stopsList.querySelectorAll('.stop-item').length;
            if (idx < count - 1) {
                showReorderDialog(ctx, idx, idx + 1).then(action => {
                    moveStop(ctx, idx, idx + 1, action);
                });
            }
        });

        // Map picker button
        item.querySelector('.btn-map-picker')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const lat = parseFloat(item.querySelector('.stop-lat')?.value) || null;
            const lng = parseFloat(item.querySelector('.stop-lng')?.value) || null;
            MapPicker.open(lat, lng, (newLat, newLng) => {
                item.querySelector('.stop-lat').value = newLat.toFixed(6);
                item.querySelector('.stop-lng').value = newLng.toFixed(6);
                updateStopHeader(item);
                debouncedSync(ctx);
            });
        });

        // Preview toggle
        item.querySelector('.btn-preview-toggle')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const btn = e.currentTarget;
            const textarea = item.querySelector('.stop-notes');
            const preview = item.querySelector('.markdown-preview');

            if (preview.style.display === 'none') {
                preview.innerHTML = parseMarkdown(textarea.value) || '<em>Žádné poznámky</em>';
                preview.style.display = 'block';
                textarea.style.display = 'none';
                btn.classList.add('active');
            } else {
                preview.style.display = 'none';
                textarea.style.display = 'block';
                btn.classList.remove('active');
            }
        });

        // Input changes
        const inputs = item.querySelectorAll('.form-input');
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                updateStopHeader(item);
                debouncedSync(ctx);
            });

            input.addEventListener('blur', () => {
                // Real-time validation on blur
                validateStopField(input);
            });

            input.addEventListener('change', () => {
                saveUndoState(ctx);
                updateStats(ctx);
            });
        });

        // Drag and drop
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.dataset.stopIndex);
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            draggedItem = null;
            elements[ctx].stopsList.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (draggedItem && item !== draggedItem) {
                elements[ctx].stopsList.querySelectorAll('.drag-over').forEach(el => {
                    if (el !== item) el.classList.remove('drag-over');
                });
                item.classList.add('drag-over');
            }
        });

        item.addEventListener('dragleave', (e) => {
            if (!item.contains(e.relatedTarget)) {
                item.classList.remove('drag-over');
            }
        });

        item.addEventListener('drop', async (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');

            if (!draggedItem || item === draggedItem) return;

            const fromIndex = parseInt(draggedItem.dataset.stopIndex);
            const toIndex = parseInt(item.dataset.stopIndex);

            const action = await showReorderDialog(ctx, fromIndex, toIndex);
            moveStop(ctx, fromIndex, toIndex, action);
        });
    }

    // Update stop header from inputs
    function updateStopHeader(item) {
        const name = item.querySelector('.stop-name')?.value || '';
        const label = item.querySelector('.stop-label')?.value || '';
        const dateFrom = item.querySelector('.stop-dateFrom')?.value || '';
        const dateTo = item.querySelector('.stop-dateTo')?.value || '';

        const title = item.querySelector('.stop-item-title');
        const subtitle = item.querySelector('.stop-item-subtitle');
        const status = item.querySelector('.stop-item-status');

        const displayName = name || label || 'Nová zastávka';
        title.textContent = displayName;
        title.classList.toggle('empty', !name && !label);

        const dates = formatDateShort(dateFrom, dateTo);
        const nights = calcNights(dateFrom, dateTo);
        if (subtitle) {
            subtitle.textContent = dates ? `${dates}${nights > 0 ? ` · ${nights} ${nights === 1 ? 'noc' : nights < 5 ? 'noci' : 'nocí'}` : ''}` : '';
        }

        const lat = parseFloat(item.querySelector('.stop-lat')?.value);
        const lng = parseFloat(item.querySelector('.stop-lng')?.value);
        const complete = name && !isNaN(lat) && !isNaN(lng);
        if (status) {
            status.classList.toggle('complete', complete);
            status.classList.toggle('incomplete', !complete);
            status.title = complete ? 'Kompletní' : 'Chybí povinná pole';
        }
    }

    // Validate stop field
    function validateStopField(input) {
        const value = input.value;
        let hasError = false;

        if (input.classList.contains('stop-lat')) {
            const lat = parseFloat(value);
            hasError = value && (isNaN(lat) || lat < -90 || lat > 90);
        } else if (input.classList.contains('stop-lng')) {
            const lng = parseFloat(value);
            hasError = value && (isNaN(lng) || lng < -180 || lng > 180);
        }

        input.classList.toggle('has-error', hasError);
    }

    // Switch mode
    function switchMode(ctx, mode) {
        const el = elements[ctx];

        if (mode === 'visual') {
            // Try to sync code to visual
            if (!syncCodeToVisual(ctx)) {
                // Invalid JSON - block switch
                showToast('JSON obsahuje chyby. Opravte je před přepnutím.');
                return false;
            }
            clearUndoHistory(ctx);
            saveUndoState(ctx);
        } else {
            // Sync visual to code
            syncVisualToCode(ctx);
            clearUndoHistory(ctx);
        }

        currentMode[ctx] = mode;

        // Update tabs
        el.tabs.querySelectorAll('.editor-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });

        // Show/hide editors
        el.visualEditor.style.display = mode === 'visual' ? 'block' : 'none';
        el.codeEditor.classList.toggle('active', mode === 'code');

        return true;
    }

    // Setup context events
    function setupContextEvents(ctx) {
        const el = elements[ctx];

        // Tab switching
        el.tabs?.addEventListener('click', (e) => {
            const tab = e.target.closest('.editor-tab');
            if (tab && !tab.classList.contains('active')) {
                switchMode(ctx, tab.dataset.mode);
            }
        });

        // Add stop button
        el.addStopBtn?.addEventListener('click', () => {
            saveUndoState(ctx);
            addStopItem(ctx, {}, null, true);
            debouncedSync(ctx);
        });

        // Plan metadata inputs
        [el.planName, el.planDateFrom, el.planDateTo].forEach(input => {
            if (input) {
                input.addEventListener('input', () => debouncedSync(ctx));
                input.addEventListener('change', () => saveUndoState(ctx));
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Only handle if modal is visible and visual editor is active
            const modal = ctx === 'input' ? document.getElementById('inputModal') : document.getElementById('editorModal');
            if (!modal.classList.contains('visible')) return;
            if (currentMode[ctx] !== 'visual') return;

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

            if (ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo(ctx);
            } else if (ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                redo(ctx);
            } else if (ctrlKey && e.key === 'n') {
                e.preventDefault();
                saveUndoState(ctx);
                addStopItem(ctx, {}, null, true);
                debouncedSync(ctx);
            } else if (ctrlKey && e.key === 'd') {
                e.preventDefault();
                const focused = document.activeElement?.closest('.stop-item');
                if (focused) {
                    duplicateStopItem(ctx, focused);
                }
            }
        });
    }

    // Initialize
    function init(ctx, prefix) {
        const modal = document.getElementById(`${prefix}Modal`);
        if (!modal) return;

        elements[ctx] = {
            tabs: modal.querySelector('.editor-tabs'),
            visualEditor: modal.querySelector('.visual-editor'),
            codeEditor: modal.querySelector('.code-editor'),
            planName: modal.querySelector(`#${prefix}PlanName`),
            planDateFrom: modal.querySelector(`#${prefix}PlanDateFrom`),
            planDateTo: modal.querySelector(`#${prefix}PlanDateTo`),
            stopsList: modal.querySelector(`#${prefix}StopsList`),
            addStopBtn: modal.querySelector(`#${prefix}AddStopBtn`),
            statsStops: modal.querySelector(`#${prefix}StatsStops`),
            statsNights: modal.querySelector(`#${prefix}StatsNights`)
        };

        setupContextEvents(ctx);

        // Initial empty state
        if (elements[ctx].stopsList && elements[ctx].stopsList.children.length === 0) {
            renderEmptyState(ctx);
        }
    }

    // Load plan into editor
    function loadPlan(ctx, plan) {
        setVisualData(ctx, plan);
        const editor = ctx === 'input' ? appState.inputEditor : appState.editorEditor;
        const json = JSON.stringify(plan, null, 2);
        editor.setValue(json, -1);
        lastSyncedData[ctx] = json;
        clearUndoHistory(ctx);
        saveUndoState(ctx);
        currentMode[ctx] = 'visual';

        const el = elements[ctx];
        el.tabs?.querySelectorAll('.editor-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === 'visual');
        });
        if (el.visualEditor) el.visualEditor.style.display = 'block';
        if (el.codeEditor) el.codeEditor.classList.remove('active');
    }

    // Get plan from editor
    function getPlan(ctx) {
        if (currentMode[ctx] === 'visual') {
            return getVisualData(ctx);
        } else {
            const editor = ctx === 'input' ? appState.inputEditor : appState.editorEditor;
            try {
                return JSON.parse(editor.getValue());
            } catch (e) {
                return null;
            }
        }
    }

    // Public API
    return {
        init,
        loadPlan,
        getPlan,
        hasUnsavedChanges,
        clearDraft,
        switchMode,
        getCurrentMode: (ctx) => currentMode[ctx]
    };
})();
