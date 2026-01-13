name: yap-new-tab
description: Guide for adding new tabs to the Yap UI

instructions: |
  You are helping add a new tab to Yap's unified web interface.

  ## Required Changes

  ### 1. Create Tab Module
  Create `app/ui/js/{tabname}.js`:
  ```javascript
  // Yap - {TabName} Tab
  // {Description}

  import { util } from './util.js';
  import { storage } from './storage.js';

  // Tab state
  let elements = {};

  // Load settings from localStorage
  function loadSettings() {
    return {
      someSetting: util.storage.get('settings.{tabname}.someSetting', defaultValue),
    };
  }

  // Initialize tab
  function init() {
    // Cache DOM elements
    elements = {
      container: document.getElementById('{tabname}-tab'),
      // ... other elements
    };
    
    // Load settings
    const settings = loadSettings();
    
    // Set up event listeners
    // ...
  }

  // Export module
  export const {tabname} = {
    init,
    // ... other public methods
  };

  window.{tabname} = {tabname};
  ```

  ### 2. Update index.html
  Add tab button in `.nav-tabs`:
  ```html
  <button data-tab="{tabname}">{TabName}</button>
  ```

  Add tab content section:
  ```html
  <div id="{tabname}-tab" class="tab-content">
    <!-- Tab content here -->
  </div>
  ```

  ### 3. Update main.js
  Import the new module:
  ```javascript
  import { {tabname} } from './{tabname}.js';
  ```

  Add to tab initialization in `initApp()`:
  ```javascript
  {tabname}.init();
  ```

  ### 4. Update styles.css (if needed)
  Add tab-specific styles with `#{tabname}-tab` selector.

  ## Conventions
  - Use `util.storage.get/set()` for settings with `settings.{tabname}.{key}` pattern
  - Use `showGlobalToast(message, type)` for notifications
  - Follow existing dark terminal theme (high contrast, minimal)
  - Ensure responsive design works on mobile
