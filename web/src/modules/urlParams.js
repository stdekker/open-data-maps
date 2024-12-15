export function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        gemeente: params.get('gemeente')
    };
}

export function updateUrlParams(gemeente) {
    const url = new URL(window.location);
    if (gemeente) {
        url.searchParams.set('gemeente', gemeente);
    } else {
        url.searchParams.delete('gemeente');
    }
    window.history.pushState({}, '', url);
} 