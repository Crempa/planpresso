// =====================
// Map and rendering (Leaflet)
// =====================

import { appState } from './state.js';
import { t } from './config.js';
import {
    formatDateCzech,
    formatNights,
    formatDateRange,
    calculateNights,
    parseNameWithEmoji
} from './utils.js';
import { savePlanToStorage } from './storage.js';
import { warnings } from './validation.js';

// Detect duplicate coordinates and apply offset
export function applyCoordinateOffsets(stops) {
    const coordMap = new Map();
    const offsetAmount = 0.015; // approximately 1.5km

    return stops.map((stop, index) => {
        const key = `${stop.lat.toFixed(4)},${stop.lng.toFixed(4)}`;

        if (!coordMap.has(key)) {
            coordMap.set(key, []);
        }

        const existing = coordMap.get(key);
        const offsetIndex = existing.length;
        existing.push(index);

        if (offsetIndex === 0) {
            return { ...stop };
        }

        // Apply offset
        const angle = (offsetIndex * 90) * (Math.PI / 180);
        return {
            ...stop,
            lat: stop.lat + offsetAmount * Math.cos(angle),
            lng: stop.lng + offsetAmount * Math.sin(angle)
        };
    });
}

// Create curved path (Bézier curve)
export function createCurvedPath(start, end) {
    const points = [];
    const midLat = (start[0] + end[0]) / 2;
    const midLng = (start[1] + end[1]) / 2;

    // Perpendicular offset for control point (always right)
    const dx = end[1] - start[1];
    const dy = end[0] - start[0];
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curve = Math.max(0.08, Math.min(0.2, 0.35 / (dist + 0.1)));

    const ctrlLat = midLat + (-dx) * curve;
    const ctrlLng = midLng + dy * curve;

    // Generate curve points
    for (let t = 0; t <= 1; t += 0.05) {
        const lat = (1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * ctrlLat + t * t * end[0];
        const lng = (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * ctrlLng + t * t * end[1];
        points.push([lat, lng]);
    }
    return points;
}

// Initialize map
export function initMap() {
    appState.leafletMap = L.map('map').setView([50, 15], 5);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(appState.leafletMap);
}

// Render plan
export function renderPlan(plan) {
    appState.currentPlan = plan;
    savePlanToStorage(plan);

    // Extract emoji and name
    const parsed = parseNameWithEmoji(plan.name);

    // Calculate dates from stops if not defined
    let tripDateFrom = plan.dateFrom;
    let tripDateTo = plan.dateTo;

    if (plan.stops && plan.stops.length > 0) {
        const allDates = plan.stops
            .flatMap(s => [s.dateFrom, s.dateTo])
            .filter(d => d)
            .map(d => new Date(d))
            .filter(d => !isNaN(d.getTime()));

        if (allDates.length > 0) {
            const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
            const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
            if (!tripDateFrom) tripDateFrom = minDate.toISOString().split('T')[0];
            if (!tripDateTo) tripDateTo = maxDate.toISOString().split('T')[0];
        }
    }

    // Update header
    document.getElementById('tripEmoji').textContent = parsed.emoji;
    document.getElementById('tripName').textContent = parsed.name;

    // Format dates for header
    let datesText = '';
    if (tripDateFrom && tripDateTo) {
        datesText = `${formatDateCzech(tripDateFrom)} – ${formatDateCzech(tripDateTo)}`;
    } else if (tripDateFrom || tripDateTo) {
        datesText = `${formatDateCzech(tripDateFrom || '?')} – ${formatDateCzech(tripDateTo || '?')}`;
    }
    document.getElementById('tripDates').textContent = datesText;
    document.title = `${parsed.name} | Cestovní plánovač`;

    // Apply offset to duplicate coordinates
    const stopsWithOffset = applyCoordinateOffsets(plan.stops);

    // Clear existing markers
    appState.markers.forEach(m => appState.leafletMap.removeLayer(m));
    appState.labels.forEach(l => appState.leafletMap.removeLayer(l));
    if (appState.routeLine) appState.leafletMap.removeLayer(appState.routeLine);
    if (appState.geodesicLine) appState.leafletMap.removeLayer(appState.geodesicLine);
    appState.markers = [];
    appState.labels = [];

    // Marker colors
    const markerColors = ['#E07A5F', '#F2CC8F', '#81B29A', '#3D405B', '#E07A5F', '#81B29A', '#3D405B', '#C45D45'];
    const totalStops = stopsWithOffset.length;

    // Create markers
    stopsWithOffset.forEach((stop, index) => {
        const color = markerColors[index % markerColors.length];

        // Determine type by position (first = start, last = end)
        const isStart = index === 0;
        const isEnd = index === totalStops - 1;

        // Icon for start/end
        let iconHtml = `<div style="
            background: ${color};
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 12px;
            font-family: 'Inter', sans-serif;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        ">${index + 1}</div>`;

        if (isStart) {
            iconHtml = `<div style="
                background: #059669;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 700;
                font-size: 14px;
                font-family: 'Inter', sans-serif;
                border: 3px solid white;
                box-shadow: 0 2px 10px rgba(5,150,105,0.4);
            ">S</div>`;
        } else if (isEnd) {
            iconHtml = `<div style="
                background: #DC2626;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 700;
                font-size: 14px;
                font-family: 'Inter', sans-serif;
                border: 3px solid white;
                box-shadow: 0 2px 10px rgba(220,38,38,0.4);
            ">C</div>`;
        }

        const marker = L.marker([stop.lat, stop.lng], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: iconHtml,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
                popupAnchor: [0, -14]
            })
        }).addTo(appState.leafletMap);

        // Calculate nights and format dates
        const nights = calculateNights(stop.dateFrom, stop.dateTo);
        const dateRange = formatDateRange(stop.dateFrom, stop.dateTo);

        const popupContent = `
            <div class="popup-title">${stop.label || stop.name}</div>
            ${dateRange ? `<div class="popup-dates">${dateRange}</div>` : ''}
            ${nights > 0 ? `<div class="popup-nights">${formatNights(nights)}</div>` : ''}
        `;
        marker.bindPopup(popupContent);
        appState.markers.push(marker);

        // Labels
        const labelText = stop.label || stop.name;
        const verticalOffset = index % 2 === 0 ? -8 : 28;
        const label = L.marker([stop.lat, stop.lng], {
            icon: L.divIcon({
                className: 'map-label-container',
                html: `<div style="
                    background: white;
                    color: #2D3142;
                    padding: 5px 10px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 500;
                    font-family: 'Inter', sans-serif;
                    white-space: nowrap;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.12);
                    border: 1px solid rgba(0,0,0,0.06);
                    margin-left: 20px;
                ">${labelText}</div>`,
                iconAnchor: [0, verticalOffset]
            })
        }).addTo(appState.leafletMap);
        appState.labels.push(label);
    });

    // Curved connections (Bézier curves)
    const routeCoords = stopsWithOffset.map(s => [s.lat, s.lng]);
    const allCurvePoints = [];

    for (let i = 0; i < routeCoords.length - 1; i++) {
        const curvePoints = createCurvedPath(routeCoords[i], routeCoords[i + 1]);
        allCurvePoints.push(...curvePoints);
    }

    if (allCurvePoints.length > 0) {
        appState.routeLine = L.polyline(allCurvePoints, {
            color: '#E07A5F',
            weight: 3,
            opacity: 0.7,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(appState.leafletMap);
    }

    // Timeline
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = '';

    // Remove previous warning element if exists
    const existingWarning = document.querySelector('.warning-message');
    if (existingWarning) existingWarning.remove();

    // Show warnings if any exist
    if (warnings.length > 0) {
        const warningEl = document.createElement('div');
        warningEl.className = 'warning-message';
        warningEl.innerHTML = warnings.join('<br>');
        timeline.parentNode.insertBefore(warningEl, timeline);
    }

    let totalNights = 0;
    let hasIncompleteDates = false;

    plan.stops.forEach((stop, index) => {
        const offsetStop = stopsWithOffset[index];
        const color = markerColors[index % markerColors.length];

        // Determine type by position
        const isStart = index === 0;
        const isEnd = index === totalStops - 1;

        // Calculate nights
        const nights = calculateNights(stop.dateFrom, stop.dateTo);
        const isDayTrip = stop.dateTo && !stop.dateFrom;

        if (stop.dateFrom || stop.dateTo) {
            totalNights += nights;
        } else {
            hasIncompleteDates = true;
        }

        const stopEl = document.createElement('div');
        stopEl.className = 'stop';
        stopEl.dataset.index = index;

        let typeColor = color;
        let typeBadge = '';
        if (isStart) {
            typeColor = '#059669';
            typeBadge = `<span class="stop-type-badge start">${t('badges.start')}</span>`;
        } else if (isEnd) {
            typeColor = '#DC2626';
            typeBadge = `<span class="stop-type-badge cil">${t('badges.end')}</span>`;
        } else if (isDayTrip) {
            typeBadge = `<span class="stop-type-badge" style="background: #FEF3C7; color: #92400E;">${t('badges.dayTrip')}</span>`;
        }

        const dateRange = formatDateRange(stop.dateFrom, stop.dateTo);

        stopEl.innerHTML = `
            <div class="stop-number" style="background: ${typeColor}">${index + 1}</div>
            <div class="stop-name">${stop.label || stop.name}${typeBadge}</div>
            ${dateRange ? `<div class="stop-dates">${dateRange}${nights > 0 ? `<span class="stop-nights">${formatNights(nights)}</span>` : ''}</div>` : ''}
            ${stop.notes ? `<div class="stop-notes"><span class="notes-icon">→</span><span>${stop.notes}</span></div>` : ''}
        `;

        stopEl.addEventListener('click', () => {
            document.querySelectorAll('.stop').forEach(s => s.classList.remove('active'));
            stopEl.classList.add('active');

            appState.leafletMap.flyTo([offsetStop.lat, offsetStop.lng], 11, {
                animate: true,
                duration: 0.8
            });
            setTimeout(() => appState.markers[index].openPopup(), 400);
        });

        timeline.appendChild(stopEl);
    });

    // Statistics
    let nightsText = formatNights(totalNights) || '0 nocí';
    if (hasIncompleteDates) {
        nightsText += ' *';
    }
    document.getElementById('statNights').textContent = nightsText;
    document.getElementById('statStops').textContent = `${plan.stops.length} míst`;

    // Fit bounds
    const bounds = L.latLngBounds(routeCoords);
    appState.leafletMap.fitBounds(bounds, { padding: [50, 50] });

    // Show sidebar
    document.getElementById('sidebar').classList.remove('app-hidden');
}
