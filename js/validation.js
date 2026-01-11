// =====================
// JSON Validation - using Zod
// =====================

import { t } from './config.js';
import { calculateDistance } from './utils.js';

// Warnings for current validation
export let warnings = [];

// Zod schemas for validation (uses Zod global)
export const StopSchema = Zod.z.object({
    name: Zod.z.string().min(1),
    lat: Zod.z.number().min(-90).max(90),
    lng: Zod.z.number().min(-180).max(180),
    dateFrom: Zod.z.string().optional(),
    dateTo: Zod.z.string().optional(),
    description: Zod.z.string().optional(),
    link: Zod.z.string().optional(),
}).passthrough();

export const PlanSchema = Zod.z.object({
    name: Zod.z.string().min(1),
    stops: Zod.z.array(StopSchema).min(1),
}).passthrough();

export function validatePlan(plan) {
    const errors = [];
    warnings = []; // Reset warnings

    // Basic validation using Zod
    const result = PlanSchema.safeParse(plan);

    if (!result.success) {
        for (const issue of result.error.issues) {
            const path = issue.path;

            if (path.length === 1 && path[0] === 'name') {
                errors.push(t('errors.missingField', { field: 'name' }));
            } else if (path.length === 1 && path[0] === 'stops') {
                if (issue.code === 'too_small') {
                    errors.push(t('errors.emptyStops'));
                } else {
                    errors.push(t('errors.missingField', { field: 'stops' }));
                }
            } else if (path.length >= 2 && path[0] === 'stops') {
                const num = path[1] + 1;
                const field = path[2];

                if (field === 'name') {
                    errors.push(t('errors.missingStopField', { num, field: 'name' }));
                } else if (field === 'lat') {
                    if (issue.code === 'too_small' || issue.code === 'too_big') {
                        errors.push(t('errors.invalidLat', { num }));
                    } else {
                        errors.push(t('errors.missingStopField', { num, field: 'lat' }));
                    }
                } else if (field === 'lng') {
                    if (issue.code === 'too_small' || issue.code === 'too_big') {
                        errors.push(t('errors.invalidLng', { num }));
                    } else {
                        errors.push(t('errors.missingStopField', { num, field: 'lng' }));
                    }
                }
            }
        }
    }

    // Extended validation (chronology, distances) - cannot be in Zod schema
    if (Array.isArray(plan.stops)) {
        let prevDateTo = null;

        plan.stops.forEach((stop, idx) => {
            const num = idx + 1;

            // Date validation
            if (stop.dateFrom && stop.dateTo) {
                const from = new Date(stop.dateFrom);
                const to = new Date(stop.dateTo);
                if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
                    if (to < from) {
                        errors.push(t('errors.dateToBeforeDateFrom', {
                            num,
                            dateFrom: stop.dateFrom,
                            dateTo: stop.dateTo
                        }));
                    }
                }
            }

            // Chronology validation
            const currentDateFrom = stop.dateFrom ? new Date(stop.dateFrom) :
                                   (stop.dateTo ? new Date(stop.dateTo) : null);

            if (prevDateTo && currentDateFrom) {
                if (currentDateFrom < prevDateTo) {
                    errors.push(t('errors.datesOverlap', { num }));
                }
            }

            if (stop.dateTo) {
                prevDateTo = new Date(stop.dateTo);
            }

            // Check for extreme distance
            if (idx > 0 && plan.stops[idx - 1].lat !== undefined && stop.lat !== undefined) {
                const prevStop = plan.stops[idx - 1];
                const distance = calculateDistance(prevStop.lat, prevStop.lng, stop.lat, stop.lng);
                if (distance > 5000) {
                    warnings.push(t('errors.extremeDistance', { num1: idx, num2: num }));
                }
            }
        });
    }

    return errors;
}

export function showErrors(errors, summaryEl, listEl, containerEl) {
    if (errors.length === 0) {
        summaryEl.classList.remove('visible');
        containerEl?.classList.remove('has-error');
        return false;
    }

    listEl.innerHTML = errors.map(e => `<li>${e}</li>`).join('');
    summaryEl.classList.add('visible');
    containerEl?.classList.add('has-error');
    return true;
}
