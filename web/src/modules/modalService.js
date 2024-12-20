export class Modal {
    constructor() {
        this.overlay = document.querySelector('.modal-overlay');
        this.modal = document.querySelector('.modal');
        this.closeButton = document.querySelector('.modal-close');
        this.content = document.querySelector('.modal-content');
        this.title = document.querySelector('.modal-title');
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Close on clicking X button
        this.closeButton.addEventListener('click', () => this.close());
        
        // Close on clicking overlay
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });
    }

    async openFromUrl(title, url) {
        try {
            const response = await fetch(url);
            const content = await response.text();
            this.open(title, content);
        } catch (error) {
            console.error('Error loading modal content:', error);
            this.open(title, '<p>Error loading content. Please try again later.</p>');
        }
    }

    open(title, content) {
        this.title.textContent = title;
        this.content.innerHTML = content;
        this.overlay.style.display = 'block';
        // Force reflow
        this.overlay.offsetHeight;
        this.overlay.classList.add('active');
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    close() {
        this.overlay.classList.remove('active');
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Wait for animation to finish before hiding
        setTimeout(() => {
            this.overlay.style.display = 'none';
        }, 150);
    }

    isOpen() {
        return this.overlay.classList.contains('active');
    }
} 