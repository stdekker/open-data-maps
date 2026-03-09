/**
 * URL parameter handling with correct semantics for restoration.
 * - elections: true | false | null (null when param is absent)
 * - Only `elections=true` is serialized; false is represented by absence
 * - Supports pushState, replaceState, and skipping history during restoration
 */

/**
 * Returns URL params. elections is null when the param is absent (so callers
 * can distinguish "not in URL" from "explicitly false").
 * @returns {{ gemeente: string|null, elections: boolean|null }}
 */
export function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const electionsParam = params.get('elections');
    const elections =
        electionsParam === null ? null : electionsParam === 'true';
    return {
        gemeente: params.get('gemeente'),
        elections
    };
}

/**
 * Updates URL and optionally history.
 * @param {string|null} gemeente - Municipality name for gemeente param (null to delete)
 * @param {boolean|null} elections - true to set, false/null to remove
 * @param {{ replace?: boolean, skipHistory?: boolean }} [options] - replace: use replaceState; skipHistory: don't update history at all (for restoration)
 */
export function updateUrlParams(gemeente, elections = null, options = {}) {
    const { replace = false, skipHistory = false } = options;
    const url = new URL(window.location.href);
    if (gemeente) {
        url.searchParams.set('gemeente', gemeente);
    } else {
        url.searchParams.delete('gemeente');
    }

    if (elections === true) {
        url.searchParams.set('elections', 'true');
    } else {
        url.searchParams.delete('elections');
    }

    if (skipHistory) return;

    if (replace) {
        window.history.replaceState({}, '', url);
    } else {
        window.history.pushState({}, '', url);
    }
}
