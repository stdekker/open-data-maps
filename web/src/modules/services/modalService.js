/**
 * A class that manages a modal dialog with content loading and animation capabilities.
 * Handles opening, closing, and event management for modal dialogs.
 */
export class Modal {
    constructor(modalId) {
        this.overlay = document.querySelector(`#${modalId}`);
        this.modal = this.overlay.querySelector('.modal');
        this.closeButton = this.overlay.querySelector('.modal-close');
        this.content = this.overlay.querySelector('.modal-content');
        this.title = this.overlay.querySelector('.modal-title');
        
        this.setupEventListeners();
    }

    /**
     * Sets up event listeners for closing the modal via button click, overlay click, or escape key.
     * @private
     */
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

    /**
     * Opens the modal with content loaded from a URL.
     * @param {string} title - The title to display in the modal header
     * @param {string} url - The URL to fetch content from
     * @returns {Promise<void>}
     */
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

    /**
     * Opens the modal with optional content.
     * @param {string} title - The title to display in the modal header
     * @param {string|null} content - Optional HTML content to display in the modal body
     */
    open(title, content = null) {
        this.title.textContent = title;
        if (content !== null) {
            this.content.innerHTML = content;
        }
        this.overlay.style.display = 'block';
        // Force reflow
        this.overlay.offsetHeight;
        this.overlay.classList.add('active');
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Closes the modal with animation and cleanup.
     * Restores body scroll and hides the overlay after animation completes.
     */
    close() {
        this.overlay.classList.remove('active');
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Wait for animation to finish before hiding
        setTimeout(() => {
            this.overlay.style.display = 'none';
        }, 150);
    }

    /**
     * Checks if the modal is currently open.
     * @returns {boolean} True if the modal is open, false otherwise
     */
    isOpen() {
        return this.overlay.classList.contains('active');
    }
} 