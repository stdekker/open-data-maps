/**
 * Context Menu Module - Provides an extensible right-click context menu for map features.
 * This module allows other modules to register menu items dynamically.
 */

/**
 * ContextMenu class - manages the context menu lifecycle and registered items
 */
export class ContextMenu {
    /**
     * Creates a new ContextMenu instance
     * @param {Object} map - The Mapbox map instance
     */
    constructor(map) {
        this.map = map;
        this.menuElement = null;
        this.registeredItems = [];
        this.currentFeature = null;
        this.currentEvent = null;
        this.isVisible = false;
        
        // Bind methods to preserve context
        this.hide = this.hide.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleMapMove = this.handleMapMove.bind(this);
        
        // Create the menu element
        this.createMenuElement();
        
        // Set up global event listeners
        this.setupEventListeners();
    }
    
    /**
     * Creates the menu DOM element
     * Styles are defined in main.css
     */
    createMenuElement() {
        // Create menu container
        this.menuElement = document.createElement('div');
        this.menuElement.className = 'map-context-menu';
        this.menuElement.setAttribute('role', 'menu');
        this.menuElement.setAttribute('aria-hidden', 'true');
        
        // Append to body
        document.body.appendChild(this.menuElement);
    }
    
    /**
     * Sets up global event listeners for closing the menu
     */
    setupEventListeners() {
        // Close on click outside
        document.addEventListener('mousedown', this.handleClickOutside);
        
        // Close on Escape key
        document.addEventListener('keydown', this.handleKeyDown);
        
        // Close on map move/zoom
        if (this.map) {
            this.map.on('movestart', this.handleMapMove);
            this.map.on('zoomstart', this.handleMapMove);
        }
    }
    
    /**
     * Handles clicks outside the menu
     * @param {MouseEvent} e - The mouse event
     */
    handleClickOutside(e) {
        if (this.isVisible && !this.menuElement.contains(e.target)) {
            this.hide();
        }
    }
    
    /**
     * Handles keyboard events
     * @param {KeyboardEvent} e - The keyboard event
     */
    handleKeyDown(e) {
        if (this.isVisible && e.key === 'Escape') {
            this.hide();
        }
    }
    
    /**
     * Handles map movement/zoom
     */
    handleMapMove() {
        if (this.isVisible) {
            this.hide();
        }
    }
    
    /**
     * Registers a menu item
     * @param {Object} config - The menu item configuration
     * @param {string} config.id - Unique identifier for the item
     * @param {string|Function} config.label - Display text or function returning text
     * @param {string} [config.icon] - Optional icon HTML/SVG
     * @param {Function} [config.condition] - Function to determine if item should be shown
     * @param {Function} config.action - Action to perform when clicked
     * @param {number} [config.order=100] - Sort order (lower = higher in menu)
     * @param {string} [config.group] - Group name for organizing items
     */
    registerItem(config) {
        // Validate required fields
        if (!config.id || !config.action) {
            console.error('ContextMenu: registerItem requires id and action');
            return;
        }
        
        // Remove existing item with same id
        this.unregisterItem(config.id);
        
        // Add defaults
        const item = {
            order: 100,
            condition: () => true,
            ...config
        };
        
        this.registeredItems.push(item);
        
        // Sort by order
        this.registeredItems.sort((a, b) => a.order - b.order);
    }
    
    /**
     * Unregisters a menu item by id
     * @param {string} id - The item id to remove
     */
    unregisterItem(id) {
        this.registeredItems = this.registeredItems.filter(item => item.id !== id);
    }
    
    /**
     * Gets the label for a menu item (handles dynamic labels)
     * @param {Object} item - The menu item
     * @param {Object} feature - The current feature
     * @returns {string} The label text
     */
    getItemLabel(item, feature) {
        if (typeof item.label === 'function') {
            return item.label(feature, this.currentEvent);
        }
        return item.label;
    }
    
    /**
     * Builds and renders the menu items
     * @param {Object} feature - The feature that was right-clicked
     */
    buildMenu(feature) {
        // Clear existing content
        this.menuElement.innerHTML = '';
        
        // Filter items based on conditions
        const visibleItems = this.registeredItems.filter(item => {
            try {
                return item.condition(feature, this.currentEvent);
            } catch (e) {
                console.warn(`ContextMenu: Error in condition for item ${item.id}:`, e);
                return false;
            }
        });
        
        if (visibleItems.length === 0) {
            return false; // Don't show empty menu
        }
        
        // Group items
        const groups = new Map();
        visibleItems.forEach(item => {
            const groupName = item.group || '__default__';
            if (!groups.has(groupName)) {
                groups.set(groupName, []);
            }
            groups.get(groupName).push(item);
        });
        
        // Render groups with dividers
        let isFirstGroup = true;
        groups.forEach((items, groupName) => {
            // Add divider between groups (not before first group)
            if (!isFirstGroup) {
                const divider = document.createElement('div');
                divider.className = 'map-context-menu-divider';
                divider.setAttribute('role', 'separator');
                this.menuElement.appendChild(divider);
            }
            isFirstGroup = false;
            
            // Render items in this group
            items.forEach(item => {
                const menuItem = document.createElement('div');
                menuItem.className = 'map-context-menu-item';
                menuItem.setAttribute('role', 'menuitem');
                menuItem.setAttribute('tabindex', '0');
                
                // Add icon if provided
                if (item.icon) {
                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'map-context-menu-item-icon';
                    iconSpan.innerHTML = item.icon;
                    menuItem.appendChild(iconSpan);
                }
                
                // Add label
                const labelSpan = document.createElement('span');
                labelSpan.className = 'map-context-menu-item-label';
                labelSpan.textContent = this.getItemLabel(item, feature);
                menuItem.appendChild(labelSpan);
                
                // Add click handler
                menuItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.hide();
                    try {
                        item.action(feature, this.currentEvent);
                    } catch (err) {
                        console.error(`ContextMenu: Error in action for item ${item.id}:`, err);
                    }
                });
                
                // Add keyboard handler
                menuItem.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        menuItem.click();
                    }
                });
                
                this.menuElement.appendChild(menuItem);
            });
        });
        
        return true;
    }
    
    /**
     * Calculates the menu position to stay within viewport
     * @param {number} x - Desired X position
     * @param {number} y - Desired Y position
     * @returns {Object} Adjusted {x, y} position
     */
    calculatePosition(x, y) {
        const menuRect = this.menuElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 8;
        
        // Adjust X if menu would overflow right edge
        if (x + menuRect.width + padding > viewportWidth) {
            x = viewportWidth - menuRect.width - padding;
        }
        
        // Adjust X if menu would overflow left edge
        if (x < padding) {
            x = padding;
        }
        
        // Adjust Y if menu would overflow bottom edge
        if (y + menuRect.height + padding > viewportHeight) {
            y = viewportHeight - menuRect.height - padding;
        }
        
        // Adjust Y if menu would overflow top edge
        if (y < padding) {
            y = padding;
        }
        
        return { x, y };
    }
    
    /**
     * Shows the context menu at the specified position
     * @param {number} x - X position (client coordinates)
     * @param {number} y - Y position (client coordinates)
     * @param {Object} feature - The feature that was right-clicked
     * @param {Object} [event] - The original event
     */
    show(x, y, feature, event = null) {
        this.currentFeature = feature;
        this.currentEvent = event;
        
        // Build menu items
        const hasItems = this.buildMenu(feature);
        if (!hasItems) {
            return; // Don't show empty menu
        }
        
        // Position menu (initially off-screen to measure)
        this.menuElement.style.left = '-9999px';
        this.menuElement.style.top = '-9999px';
        this.menuElement.classList.add('visible');
        
        // Calculate adjusted position after menu is rendered
        requestAnimationFrame(() => {
            const pos = this.calculatePosition(x, y);
            this.menuElement.style.left = `${pos.x}px`;
            this.menuElement.style.top = `${pos.y}px`;
            this.menuElement.setAttribute('aria-hidden', 'false');
            this.isVisible = true;
            
            // Focus first item for keyboard navigation
            const firstItem = this.menuElement.querySelector('.map-context-menu-item');
            if (firstItem) {
                firstItem.focus();
            }
        });
    }
    
    /**
     * Hides the context menu
     */
    hide() {
        this.menuElement.classList.remove('visible');
        this.menuElement.setAttribute('aria-hidden', 'true');
        this.isVisible = false;
        this.currentFeature = null;
        this.currentEvent = null;
    }
    
    /**
     * Cleans up the context menu and removes event listeners
     */
    destroy() {
        document.removeEventListener('mousedown', this.handleClickOutside);
        document.removeEventListener('keydown', this.handleKeyDown);
        
        if (this.map) {
            this.map.off('movestart', this.handleMapMove);
            this.map.off('zoomstart', this.handleMapMove);
        }
        
        if (this.menuElement && this.menuElement.parentNode) {
            this.menuElement.parentNode.removeChild(this.menuElement);
        }
        
        this.registeredItems = [];
    }
}

// Singleton instance for shared use across modules
let contextMenuInstance = null;

/**
 * Gets or creates the shared context menu instance
 * @param {Object} map - The Mapbox map instance (required on first call)
 * @returns {ContextMenu} The context menu instance
 */
export function getContextMenu(map) {
    if (!contextMenuInstance && map) {
        contextMenuInstance = new ContextMenu(map);
    }
    return contextMenuInstance;
}

