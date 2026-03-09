import { getUrlParams, updateUrlParams } from './urlParams.js';

/**
 * Reads the current route state relevant to the sidebar.
 */
export function readRouteState() {
    return getUrlParams();
}

/**
 * Writes sidebar route state back to the URL.
 * @param {{ gemeente?: string|null, elections?: boolean|null }} routeState
 * @param {{ replace?: boolean, skipHistory?: boolean }} [options]
 */
export function writeRouteState(routeState, options = {}) {
    updateUrlParams(
        routeState.gemeente ?? null,
        routeState.elections ?? null,
        options
    );
}

/**
 * Binds popstate and forwards normalized route state to a callback.
 * @param {(routeState: { gemeente: string|null, elections: boolean|null }) => void} onRouteChange
 */
export function bindPopstate(onRouteChange) {
    window.addEventListener('popstate', () => {
        onRouteChange(readRouteState());
    });
}
