/**
 * Focused regression tests for sidebar state: URL params, state module, and request token.
 * Run from web/: node --test tests/sidebar-state.test.js
 * (Requires globalThis.window and globalThis.localStorage to be set before importing app modules.)
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert';

// Mock window and history for urlParams
const historyEntries = [];
const mockHistory = {
    pushState(_data, _title, url) {
        historyEntries.push({ url: url.toString(), replace: false });
    },
    replaceState(_data, _title, url) {
        historyEntries.push({ url: url.toString(), replace: true });
    }
};

function setLocation(search) {
    const searchPart = search && !search.startsWith('?') ? '?' + search : search || '';
    const href = 'http://localhost/' + (searchPart ? searchPart : '');
    globalThis.window = {
        location: { search: searchPart || '', href },
        history: mockHistory
    };
}

describe('urlParams', () => {
    it('getUrlParams returns elections null when param is absent', async () => {
        setLocation('?gemeente=Amersfoort');
        const { getUrlParams } = await import('../src/modules/urlParams.js');
        const params = getUrlParams();
        assert.strictEqual(params.gemeente, 'Amersfoort');
        assert.strictEqual(params.elections, null);
    });

    it('getUrlParams returns elections true when param is true', async () => {
        setLocation('?gemeente=Amersfoort&elections=true');
        const { getUrlParams } = await import('../src/modules/urlParams.js');
        const params = getUrlParams();
        assert.strictEqual(params.elections, true);
    });

    it('getUrlParams returns elections false when param is false', async () => {
        setLocation('?gemeente=Amersfoort&elections=false');
        const { getUrlParams } = await import('../src/modules/urlParams.js');
        const params = getUrlParams();
        assert.strictEqual(params.elections, false);
    });

    it('updateUrlParams with skipHistory does not push history', async () => {
        setLocation('?gemeente=X');
        historyEntries.length = 0;
        const { updateUrlParams } = await import('../src/modules/urlParams.js');
        updateUrlParams('Y', false, { skipHistory: true });
        assert.strictEqual(historyEntries.length, 0);
    });

    it('updateUrlParams removes elections param when false', async () => {
        setLocation('?gemeente=Amersfoort&elections=true');
        historyEntries.length = 0;
        const { updateUrlParams } = await import('../src/modules/urlParams.js');
        updateUrlParams('Amersfoort', false);
        assert.strictEqual(historyEntries.length, 1);
        assert.strictEqual(historyEntries[0].url, 'http://localhost/?gemeente=Amersfoort');
    });

    it('updateUrlParams with replace uses replaceState', async () => {
        setLocation('?gemeente=X');
        historyEntries.length = 0;
        const { updateUrlParams } = await import('../src/modules/urlParams.js');
        updateUrlParams(null, null, { replace: true });
        assert.strictEqual(historyEntries.length, 1);
        assert.strictEqual(historyEntries[0].replace, true);
    });
});

describe('state', () => {
    before(() => {
        const storage = {};
        globalThis.localStorage = {
            getItem(k) { return storage[k] ?? null; },
            setItem(k, v) { storage[k] = String(v); },
            removeItem(k) { delete storage[k]; }
        };
    });

    it('invalidateRequestToken increments active token', async () => {
        const State = await import('../src/modules/state.js');
        const token1 = State.getActiveRequestToken();
        State.invalidateRequestToken();
        const token2 = State.getActiveRequestToken();
        assert.ok(typeof token2 === 'number');
        assert.ok(token2 !== token1 || token1 === 0);
    });

    it('setShowPostcodeLayer and getShowPostcodeLayer roundtrip', async () => {
        const State = await import('../src/modules/state.js');
        State.setShowPostcodeLayer(true);
        assert.strictEqual(State.getShowPostcodeLayer(), true);
        State.setShowPostcodeLayer(false);
        assert.strictEqual(State.getShowPostcodeLayer(), false);
    });
});

describe('municipal election cleanup', () => {
    before(() => {
        const storage = {};
        globalThis.localStorage = {
            getItem(k) { return storage[k] ?? null; },
            setItem(k, v) { storage[k] = String(v); },
            removeItem(k) { delete storage[k]; }
        };
    });

    it('clearMunicipalElectionPresentation removes reporting units and clears runtime UI state', async () => {
        let removedActiveClass = false;
        const featureNameContent = {};
        const featureInfoBox = {
            querySelector(selector) {
                return selector === '.feature-name-content' ? featureNameContent : null;
            },
            style: {}
        };
        const statsView = {
            innerHTML: '<div>old stats</div>',
            style: { display: 'block' },
            querySelectorAll() {
                return [{
                    classList: {
                        remove(className) {
                            if (className === 'active') {
                                removedActiveClass = true;
                            }
                        }
                    }
                }];
            }
        };

        globalThis.document = {
            querySelector(selector) {
                if (selector === '.stats-view') return statsView;
                if (selector === '.feature-info-box') return featureInfoBox;
                return null;
            }
        };

        const popup = {
            removed: false,
            remove() {
                this.removed = true;
            }
        };

        globalThis.window = {
            location: { search: '', href: 'http://localhost/' },
            history: mockHistory,
            reportingUnitsPopup: popup
        };

        const layers = new Map([
            ['reporting-units', { id: 'reporting-units', source: 'reporting-units' }],
            ['reporting-units-expected', { id: 'reporting-units-expected', source: 'reporting-units' }],
            ['party-votes', { id: 'party-votes', source: 'reporting-units' }]
        ]);
        const sources = new Set(['reporting-units']);

        const map = {
            isStyleLoaded() {
                return true;
            },
            getStyle() {
                return { layers: Array.from(layers.values()) };
            },
            getLayer(id) {
                return layers.get(id);
            },
            getSource(id) {
                return sources.has(id) ? { id } : undefined;
            },
            removeLayer(id) {
                layers.delete(id);
            },
            removeSource(id) {
                sources.delete(id);
            }
        };

        const { clearMunicipalElectionPresentation, setActiveParty } = await import('../src/modules/services/electionService.js');

        setActiveParty('ExampleParty');
        clearMunicipalElectionPresentation(map);

        assert.strictEqual(map.getLayer('reporting-units'), undefined);
        assert.strictEqual(map.getLayer('reporting-units-expected'), undefined);
        assert.strictEqual(map.getSource('reporting-units'), undefined);
        assert.strictEqual(globalThis.window.reportingUnitsPopup, null);
        assert.strictEqual(popup.removed, true);
        assert.strictEqual(statsView.innerHTML, '');
        assert.strictEqual(statsView.style.display, 'none');
        assert.strictEqual(removedActiveClass, true);
    });
});
