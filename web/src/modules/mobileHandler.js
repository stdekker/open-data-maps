/**
 * Initializes mobile-specific UI behavior for the sidebar.
 * Only runs on screens narrower than 768px.
 * Adds click handling to collapse/expand the sidebar when clicking near its top edge.
 */
export function initializeMobileHandler() {
    if (!window.matchMedia("(max-width: 768px)").matches) {
        return;
    }

    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.add('collapsed');
    
    // Remove old touch event listeners and add click handler
    sidebar.addEventListener('click', (e) => {
        // Check if click was on the handle (near the top of sidebar)
        const clickY = e.clientY;
        const sidebarTop = sidebar.getBoundingClientRect().top;
        const isClickNearHandle = clickY - sidebarTop < 40;
        
        if (isClickNearHandle) {
            sidebar.style.transition = 'transform 0.3s ease-out';
            
            if (sidebar.classList.contains('collapsed')) {
                // Expand
                sidebar.style.transform = 'translateY(0)';
                sidebar.classList.remove('collapsed');
            } else {
                // Collapse
                sidebar.classList.add('collapsed');
                sidebar.style.transform = 'translateY(calc(100% - 120px))';
            }
        }
    });
} 