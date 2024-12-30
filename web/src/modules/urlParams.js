export function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        gemeente: params.get('gemeente'),
        elections: params.get('elections') === 'true'
    };
}

export function updateUrlParams(gemeente, elections = null) {
    const url = new URL(window.location);
    if (gemeente) {
        url.searchParams.set('gemeente', gemeente);
    } else {
        url.searchParams.delete('gemeente');
    }
    
    if (elections !== null) {
        url.searchParams.set('elections', elections);
    }
    
    window.history.pushState({}, '', url);
} 