// =====================
// Map Picker Module
// =====================

export const MapPicker = (function() {
    let overlay = null;
    let pickerMap = null;
    let marker = null;
    let selectedLat = null;
    let selectedLng = null;
    let onConfirmCallback = null;
    let searchTimeout = null;

    function createOverlay() {
        const html = `
            <div class="map-picker-overlay" id="mapPickerOverlay">
                <div class="map-picker-header">
                    <div class="map-picker-search" style="position: relative;">
                        <input type="text" id="mapPickerSearchInput" placeholder="Hledat místo...">
                        <div class="map-picker-search-results" id="mapPickerSearchResults"></div>
                    </div>
                </div>
                <div class="map-picker-body">
                    <div id="pickerMap"></div>
                </div>
                <div class="map-picker-footer">
                    <div class="map-picker-coords" id="mapPickerCoords">
                        Klikněte na mapu pro výběr místa
                    </div>
                    <div class="map-picker-actions">
                        <button class="btn btn-secondary" id="mapPickerCancelBtn">Zrušit</button>
                        <button class="btn btn-primary" id="mapPickerConfirmBtn" disabled>Potvrdit</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        overlay = document.getElementById('mapPickerOverlay');

        // Initialize map
        pickerMap = L.map('pickerMap').setView([50, 15], 5);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(pickerMap);

        // Map click handler
        pickerMap.on('click', (e) => {
            setMarker(e.latlng.lat, e.latlng.lng);
        });

        // Cancel button
        document.getElementById('mapPickerCancelBtn').addEventListener('click', close);

        // Confirm button
        document.getElementById('mapPickerConfirmBtn').addEventListener('click', () => {
            if (selectedLat !== null && selectedLng !== null && onConfirmCallback) {
                onConfirmCallback(selectedLat, selectedLng);
            }
            close();
        });

        // Search input
        const searchInput = document.getElementById('mapPickerSearchInput');
        const searchResults = document.getElementById('mapPickerSearchResults');

        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();

            if (query.length < 2) {
                searchResults.classList.remove('visible');
                return;
            }

            searchTimeout = setTimeout(() => {
                searchPlaces(query);
            }, 300);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchResults.classList.remove('visible');
            }
        });

        // Close search results on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.map-picker-search')) {
                searchResults.classList.remove('visible');
            }
        });
    }

    function setMarker(lat, lng) {
        selectedLat = lat;
        selectedLng = lng;

        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng], {
                draggable: true
            }).addTo(pickerMap);

            marker.on('dragend', () => {
                const pos = marker.getLatLng();
                selectedLat = pos.lat;
                selectedLng = pos.lng;
                updateCoordsDisplay();
            });
        }

        updateCoordsDisplay();
        document.getElementById('mapPickerConfirmBtn').disabled = false;
    }

    function updateCoordsDisplay() {
        const coords = document.getElementById('mapPickerCoords');
        if (selectedLat !== null && selectedLng !== null) {
            coords.innerHTML = `<strong>Lat:</strong> ${selectedLat.toFixed(6)} &nbsp; <strong>Lng:</strong> ${selectedLng.toFixed(6)}`;
        }
    }

    async function searchPlaces(query) {
        const results = document.getElementById('mapPickerSearchResults');

        try {
            const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                results.innerHTML = data.features.map(f => {
                    const props = f.properties;
                    const name = props.name || '';
                    const city = props.city || props.county || '';
                    const country = props.country || '';
                    const display = [name, city, country].filter(Boolean).join(', ');

                    return `<div class="map-picker-search-result" data-lat="${f.geometry.coordinates[1]}" data-lng="${f.geometry.coordinates[0]}">${display}</div>`;
                }).join('');

                results.querySelectorAll('.map-picker-search-result').forEach(item => {
                    item.addEventListener('click', () => {
                        const lat = parseFloat(item.dataset.lat);
                        const lng = parseFloat(item.dataset.lng);
                        setMarker(lat, lng);
                        pickerMap.setView([lat, lng], 14);
                        results.classList.remove('visible');
                        document.getElementById('mapPickerSearchInput').value = item.textContent;
                    });
                });

                results.classList.add('visible');
            } else {
                results.innerHTML = '<div class="map-picker-search-result">Nic nenalezeno</div>';
                results.classList.add('visible');
            }
        } catch (e) {
            results.innerHTML = '<div class="map-picker-search-result">Chyba při hledání</div>';
            results.classList.add('visible');
        }
    }

    function open(lat, lng, callback) {
        if (!overlay) createOverlay();

        selectedLat = null;
        selectedLng = null;
        onConfirmCallback = callback;

        // Clear previous marker
        if (marker) {
            pickerMap.removeLayer(marker);
            marker = null;
        }

        // Reset UI
        document.getElementById('mapPickerSearchInput').value = '';
        document.getElementById('mapPickerSearchResults').classList.remove('visible');
        document.getElementById('mapPickerCoords').textContent = 'Klikněte na mapu pro výběr místa';
        document.getElementById('mapPickerConfirmBtn').disabled = true;

        // Set initial position if provided
        if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
            setMarker(lat, lng);
            pickerMap.setView([lat, lng], 12);
        } else {
            pickerMap.setView([50, 15], 5);
        }

        overlay.classList.add('visible');

        // Fix map size after display
        setTimeout(() => {
            pickerMap.invalidateSize();
        }, 100);
    }

    function close() {
        if (overlay) {
            overlay.classList.remove('visible');
        }
    }

    return { open, close };
})();
