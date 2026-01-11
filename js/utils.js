// =====================
// Utility functions
// =====================

// Toast element reference (will be set during initialization)
let toastElement = null;

export function setToastElement(element) {
    toastElement = element;
}

export function showToast(message) {
    if (!toastElement) {
        toastElement = document.getElementById('toast');
    }
    if (toastElement) {
        toastElement.textContent = message;
        toastElement.classList.add('visible');
        setTimeout(() => toastElement.classList.remove('visible'), 3000);
    }
}

export function showModal(modal) {
    modal.classList.add('visible');
}

export function hideModal(modal) {
    modal.classList.remove('visible');
}

export function formatNights(count) {
    if (!count) return '';
    if (count === 1) return '1 noc';
    if (count < 5) return `${count} noci`;
    return `${count} nocí`;
}

export function formatPlaces(count) {
    if (count === 1) return '1 místo';
    if (count < 5) return `${count} místa`;
    return `${count} míst`;
}

// Format date in Czech (15. ledna 2025) - using date-fns
export function formatDateCzech(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return dateFns.format(date, 'd. MMMM yyyy', { locale: dateFns.locale.cs });
}

// Calculate nights from dateFrom and dateTo - using date-fns
export function calculateNights(dateFrom, dateTo) {
    if (!dateFrom || !dateTo) return 0;
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return 0;
    return Math.max(0, dateFns.differenceInDays(to, from));
}

// Extract emoji from name
export function parseNameWithEmoji(name) {
    if (!name) return { emoji: '', name: '' };
    const match = name.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*/u);
    return {
        emoji: match ? match[1] : '',
        name: match ? name.slice(match[0].length) : name
    };
}

// Calculate distance between two points (Haversine formula)
export function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Format date range
export function formatDateRange(dateFrom, dateTo) {
    if (!dateFrom && !dateTo) return '';
    if (!dateFrom) return formatDateCzech(dateTo);
    if (!dateTo) return formatDateCzech(dateFrom);
    return `${formatDateCzech(dateFrom)} – ${formatDateCzech(dateTo)}`;
}

// Parse dates (flexible) - using date-fns
export function tryParseDate(str) {
    if (!str) return null;

    const referenceDate = new Date();
    const csLocale = dateFns.locale.cs;

    // Supported formats
    const formats = [
        'd.M.yyyy',      // 15.1.2025
        'd. M. yyyy',    // 15. 1. 2025
        'yyyy-MM-dd',    // 2025-01-15
        'yyyy/MM/dd',    // 2025/01/15
        'd. MMMM yyyy',  // 15. ledna 2025
    ];

    for (const fmt of formats) {
        try {
            const parsed = dateFns.parse(str.trim(), fmt, referenceDate, { locale: csLocale });
            if (dateFns.isValid(parsed)) {
                return parsed;
            }
        } catch (e) {
            // Continue to next format
        }
    }

    // Fallback to native Date
    const native = new Date(str);
    if (!isNaN(native.getTime())) {
        return native;
    }

    return null;
}

// Parse markdown with DOMPurify sanitization
export function parseMarkdown(text) {
    if (!text) return '';
    const html = marked.parse(text, { breaks: true });
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['strong', 'em', 'a', 'ul', 'ol', 'li', 'p', 'br'],
        ALLOWED_ATTR: ['href', 'target']
    });
}

// Format distance in human readable format
export function formatDistance(km) {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
}

// Helper function for auto-formatting JSON in editor
export function formatJsonInEditor(editor) {
    try {
        const value = editor.getValue();
        if (value.trim()) {
            const parsed = JSON.parse(value);
            editor.setValue(JSON.stringify(parsed, null, 2), -1);
        }
    } catch (e) {
        // Leave as is if not valid JSON
    }
}
