// =====================
// LocalStorage and URL compression
// =====================

const STORAGE_KEY = 'travel-planner-saved-plan-v2';
const OLD_STORAGE_KEY = 'travel-planner-saved-plan';

// URL compression/decompression (uses LZString global)
export function compressJSON(json) {
    const jsonStr = JSON.stringify(json);
    return LZString.compressToEncodedURIComponent(jsonStr);
}

export function decompressJSON(str) {
    try {
        const decompressed = LZString.decompressFromEncodedURIComponent(str);
        return JSON.parse(decompressed);
    } catch (e) {
        return null;
    }
}

export function getShareURL(currentPlan) {
    if (!currentPlan) return null;
    const compressed = compressJSON(currentPlan);
    return `${window.location.origin}${window.location.pathname}?plan=${compressed}`;
}

export function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get('plan');
    if (planParam) {
        const plan = decompressJSON(planParam);
        if (plan) {
            return plan;
        }
    }
    return null;
}

// LocalStorage functions
export function savePlanToStorage(plan) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    } catch (e) {
        console.warn('Failed to save plan to localStorage:', e);
    }
}

export function loadPlanFromStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Failed to load plan from localStorage:', e);
    }
    return null;
}

export function clearStorage() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.warn('Failed to clear localStorage:', e);
    }
}

// Delete old incompatible data on startup
export function clearOldStorage() {
    try {
        localStorage.removeItem(OLD_STORAGE_KEY);
    } catch (e) {
        // Ignore
    }
}
