export function initializeMobileHandler() {
    if (!window.matchMedia("(max-width: 768px)").matches) {
        return;
    }

    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.add('collapsed');
    
    // Remove old touch event listeners and add click handler
    const handle = sidebar.querySelector('::before');
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
                sidebar.style.transform = '';
            }
        }
    });
} 