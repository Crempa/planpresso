// =====================
// Configuration and i18n translations
// =====================

export const translations = {
    cs: {
        title: 'Cestovní plánovač',
        loadPlan: 'Načíst plán',
        useExample: 'Použít ukázku',
        share: 'Sdílet',
        editJson: 'Upravit JSON',
        exportPng: 'Export PNG',
        showRoutes: 'Zobrazit spojnice trasy',
        showLabels: 'Zobrazit popisky na mapě',
        stats: 'Statistiky cesty',
        totalNights: 'Celková délka',
        stopCount: 'Počet zastávek',
        nights: 'nocí',
        places: 'míst',
        showList: 'Zobrazit seznam',
        showMap: 'Zobrazit mapu',
        errors: {
            invalidJson: 'JSON není platný. Zkontrolujte, zda jsou všechny závorky správně uzavřené.',
            missingField: 'Chybí povinné pole "{field}" v hlavní části plánu.',
            missingStopField: 'Zastávka č. {num} nemá zadané pole "{field}".',
            invalidLat: 'Zastávka č. {num}: Zeměpisná šířka (lat) musí být v rozsahu -90 až 90.',
            invalidLng: 'Zastávka č. {num}: Zeměpisná délka (lng) musí být v rozsahu -180 až 180.',
            emptyStops: 'Plán musí obsahovat alespoň jednu zastávku.',
            dateToBeforeDateFrom: 'Zastávka č. {num}: dateTo ({dateTo}) je dříve než dateFrom ({dateFrom}).',
            datesNotChronological: 'Zastávka č. {num}: datum nenavazuje na předchozí zastávku.',
            datesOverlap: 'Zastávka č. {num}: data se překrývají s předchozí zastávkou.',
            extremeDistance: 'Upozornění: Vzdálenost mezi zastávkou č. {num1} a č. {num2} je větší než 5000 km.'
        },
        toast: {
            copied: 'Odkaz byl zkopírován do schránky',
            jsonCopied: 'JSON byl zkopírován do schránky',
            saved: 'Změny byly uloženy',
            exportStarted: 'Generuji obrázek...',
            exportDone: 'Export dokončen',
            exportFailed: 'Export selhal'
        },
        badges: {
            start: '🟢 Start',
            end: '🔴 Cíl',
            dayTrip: '☀️ Denní výlet'
        }
    }
};

export const lang = 'cs';

export function t(key, params = {}) {
    const keys = key.split('.');
    let value = translations[lang];
    for (const k of keys) {
        value = value?.[k];
    }
    if (typeof value === 'string') {
        return value.replace(/\{(\w+)\}/g, (_, p) => params[p] || '');
    }
    return key;
}
