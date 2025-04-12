// Side Panel script for Story Checker extension
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const authButton = document.getElementById('auth-button');
  const authStatus = document.getElementById('auth-status');
  const authSection = document.getElementById('auth-section');
  const profilesSection = document.getElementById('profiles-section');
  const profilesList = document.getElementById('profiles-list');
  const reloadButton = document.getElementById('reload-button');
  const settingsButton = document.getElementById('settings-button');
  const historyButton = document.getElementById('history-button');
  const statusMessage = document.getElementById('status-message');
  
  // Current profile elements
  const currentProfileName = document.getElementById('current-profile-name');
  const currentProfileUrl = document.getElementById('current-profile-url');
  const currentProfilePlatform = document.getElementById('current-profile-platform');
  const openProfileButton = document.getElementById('open-profile-button');
  
  // Action buttons
  const yesBigButton = document.getElementById('yes-big-button');
  const noBigButton = document.getElementById('no-big-button');
  const prevProfileButton = document.getElementById('prev-profile');
  const nextProfileButton = document.getElementById('next-profile');
  
  // Keep track of last check date for grouping
  let lastCheckDate = null;
  
  // Global profiles data
  let profiles = [];
  let currentProfileIndex = 0;
  let isNavigating = false; // Prevent multiple rapid navigations
  
  // Check auth status on load
  checkAuthStatus();
  
  // Set up event listeners
  authButton.addEventListener('click', authenticateWithGoogle);
  reloadButton.addEventListener('click', loadProfiles);
  settingsButton.addEventListener('click', openOptionsPage);
  historyButton.addEventListener('click', openHistoryPage);
  
  // Action buttons
  yesBigButton.addEventListener('click', () => logChoice(currentProfileIndex, 'YES'));
  noBigButton.addEventListener('click', () => logChoice(currentProfileIndex, 'NO'));
  prevProfileButton.addEventListener('click', () => navigateToProfile(currentProfileIndex - 1));
  nextProfileButton.addEventListener('click', () => navigateToProfile(currentProfileIndex + 1));
  openProfileButton.addEventListener('click', () => openProfile(currentProfileIndex));
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', handleKeyPress);
  
  // Functions
  function checkAuthStatus() {
    chrome.storage.local.get(['authToken'], (result) => {
      if (result.authToken) {
        authStatus.textContent = 'Authenticated ✓';
        authStatus.classList.add('success');
        authSection.style.display = 'none';
        profilesSection.style.display = 'block';
        loadProfiles();
      } else {
        authStatus.textContent = 'Please authenticate to get started';
        authStatus.classList.remove('success');
        authSection.style.display = 'block';
        profilesSection.style.display = 'none';
      }
    });
  }
  
  function authenticateWithGoogle() {
    authButton.disabled = true;
    authStatus.textContent = 'Authenticating...';
    
    chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
      authButton.disabled = false;
      
      if (response && response.success) {
        authStatus.textContent = 'Authentication successful! Loading profiles...';
        authStatus.classList.add('success');
        authSection.style.display = 'none';
        profilesSection.style.display = 'block';
        loadProfiles();
      } else {
        const error = response ? response.error : 'Unknown error';
        authStatus.textContent = `Authentication failed: ${error}`;
        authStatus.classList.add('error');
      }
    });
  }
  
  function loadProfiles() {
    showStatusMessage('Loading profiles...', 'info');
    profilesList.innerHTML = '<p>Loading profiles...</p>';
    
    chrome.runtime.sendMessage({ action: 'fetchProfiles' }, (response) => {
      if (response && response.success) {
        profiles = response.profiles;
        displayProfiles(profiles);
        showStatusMessage('Profiles loaded successfully!', 'success');
        
        // Start preloading profiles
        chrome.runtime.sendMessage({
          action: 'preloadProfiles',
          profiles: profiles,
          currentIndex: 0
        });
        
        // Automatically open the first profile
        if (profiles.length > 0) {
          setTimeout(() => {
            openProfile(0);
          }, 300); // Reduced delay for faster start
        }
      } else {
        const error = response ? response.error : 'Unknown error';
        profilesList.innerHTML = `<p class="error-text">Error loading profiles: ${error}</p>`;
        showStatusMessage(`Error: ${error}`, 'error');
      }
    });
  }
  
  function displayProfiles(profiles) {
    profilesList.innerHTML = '';
    
    profiles.forEach((profile, index) => {
      const profileItem = document.createElement('div');
      profileItem.className = 'profile-item';
      profileItem.dataset.index = index;
      
      const name = document.createElement('div');
      name.className = 'profile-name';
      name.textContent = profile.name;
      
      const url = document.createElement('div');
      url.className = 'profile-url';
      url.textContent = profile.url;
      
      profileItem.appendChild(name);
      profileItem.appendChild(url);
      
      profileItem.addEventListener('click', () => {
        if (!isNavigating) {
          isNavigating = true;
          navigateToProfile(index);
          setTimeout(() => { isNavigating = false; }, 200);
        }
      });
      
      profilesList.appendChild(profileItem);
    });
  }
  
  function navigateToProfile(index) {
    if (index >= 0 && index < profiles.length) {
      currentProfileIndex = index;
      updateCurrentProfileDisplay(index);
      
      // Open the profile in a tab
      chrome.runtime.sendMessage({
        action: 'openProfile',
        url: profiles[index].url,
        name: profiles[index].name,
        platform: profiles[index].platform,
        index: index
      });
    }
  }
  
  function logChoice(index, choice) {
    if (profiles[index]) {
      const profile = profiles[index];
      chrome.runtime.sendMessage({
        action: 'logChoice',
        profile: profile,
        choice: choice,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  function updateCurrentProfileDisplay(index) {
    if (profiles.length === 0) return;
    
    currentProfileIndex = index;
    const profile = profiles[index];
    
    // Update the current profile section
    currentProfileName.textContent = profile.name;
    currentProfileUrl.textContent = profile.url;
    currentProfilePlatform.textContent = profile.platform;
    
    // Update active state in the list
    const allItems = profilesList.querySelectorAll('.profile-item');
    allItems.forEach((item, i) => {
      if (i === index) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
  
  function openProfile(index) {
    if (profiles.length === 0) return;
    
    // Make sure we're displaying the right profile
    updateCurrentProfileDisplay(index);
    
    const profile = profiles[index];
    
    // Show the profile being opened
    showStatusMessage(`Opening ${profile.name}'s profile...`, 'info');
    
    chrome.runtime.sendMessage(
      { 
        action: 'openProfile',
        url: profile.url,
        name: profile.name,
        platform: profile.platform,
        index: index // Pass the index to the background script for preloading
      }, 
      (response) => {
        if (!response || !response.success) {
          const error = response ? response.error : 'Unknown error';
          showStatusMessage(`Error opening profile: ${error}`, 'error');
        } else {
          // Mark this profile as the currently active one
          currentProfileIndex = index;
        }
      }
    );
  }
  
  function handleKeyPress(e) {
    // Only process if profiles are loaded
    if (profiles.length === 0) return;
    
    // Don't process keys if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    switch(e.key) {
      case 'y':
      case 'Y':
        // Log YES for current profile
        logChoice(currentProfileIndex, 'YES');
        break;
      case 'n':
      case 'N':
        // Log NO for current profile  
        logChoice(currentProfileIndex, 'NO');
        break;
      case 'ArrowDown':
      case 'j':
        // Next profile
        navigateToProfile(currentProfileIndex + 1);
        break;
      case 'ArrowUp':
      case 'k':
        // Previous profile
        navigateToProfile(currentProfileIndex - 1);
        break;
      case 'o':
      case 'O':
        // Open current profile
        openProfile(currentProfileIndex);
        break;
      case 'r':
      case 'R':
        // Reload profiles
        loadProfiles();
        break;
    }
  }
  
  function openOptionsPage() {
    // First attempt to use the standard options page
    chrome.runtime.openOptionsPage(function() {
      // If there was an error (options page not defined properly)
      if (chrome.runtime.lastError) {
        // Open our custom settings dialog instead
        openCustomSettings();
      }
    });
  }
  
  function openCustomSettings() {
    // Check if settings dialog already exists
    let settingsDialog = document.getElementById('settings-dialog');
    
    if (!settingsDialog) {
      // Create settings dialog
      settingsDialog = document.createElement('div');
      settingsDialog.id = 'settings-dialog';
      settingsDialog.className = 'settings-dialog';
      
      settingsDialog.innerHTML = `
        <div class="settings-dialog-content">
          <div class="settings-header">
            <h3>Story Checker Settings</h3>
            <button id="close-settings" class="close-button">&times;</button>
          </div>
          <div class="settings-body">
            <div class="form-group">
              <label for="people-sheet-id">People Sheet ID:</label>
              <input type="text" id="people-sheet-id" placeholder="Google Sheet ID">
            </div>
            
            <div class="form-group">
              <label for="log-sheet-id">Log Sheet ID:</label>
              <input type="text" id="log-sheet-id" placeholder="Google Sheet ID">
            </div>
            
            <div class="form-group">
              <label for="special-profiles">Special Profiles (Names only, one per line):</label>
              <textarea id="special-profiles" placeholder="Enter names, one per line"></textarea>
              <p class="help-text">For these profiles, their name will be logged instead of the URL</p>
            </div>
          </div>
          <div class="settings-footer">
            <button id="save-settings" class="save-button">Save Settings</button>
          </div>
        </div>
      `;
      
      // Add settings dialog styles
      const style = document.createElement('style');
      style.textContent = `
        .settings-dialog {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0,0,0,0.5);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .settings-dialog-content {
          background-color: white;
          border-radius: 8px;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        
        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          border-bottom: 1px solid #eee;
        }
        
        .settings-header h3 {
          margin: 0;
        }
        
        .close-button {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
        }
        
        .settings-body {
          padding: 20px;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        
        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        
        .form-group textarea {
          height: 100px;
          resize: vertical;
        }
        
        .help-text {
          font-size: 12px;
          color: #666;
          margin-top: 5px;
        }
        
        .settings-footer {
          padding: 15px 20px;
          border-top: 1px solid #eee;
          text-align: right;
        }
        
        .save-button {
          background-color: #007bff;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .save-button:hover {
          background-color: #0056b3;
        }
      `;
      
      document.head.appendChild(style);
      document.body.appendChild(settingsDialog);
      
      // Load current settings
      chrome.storage.local.get(['peopleSheetId', 'logSheetId', 'specialProfiles'], function(data) {
        document.getElementById('people-sheet-id').value = data.peopleSheetId || '';
        document.getElementById('log-sheet-id').value = data.logSheetId || '';
        
        // Load special profiles
        const specialProfiles = data.specialProfiles || [];
        document.getElementById('special-profiles').value = specialProfiles.join('\n');
      });
      
      // Set up event listeners
      document.getElementById('close-settings').addEventListener('click', function() {
        document.body.removeChild(settingsDialog);
      });
      
      document.getElementById('save-settings').addEventListener('click', function() {
        const peopleSheetId = document.getElementById('people-sheet-id').value.trim();
        const logSheetId = document.getElementById('log-sheet-id').value.trim();
        const specialProfilesText = document.getElementById('special-profiles').value;
        
        // Parse special profiles (one name per line)
        const specialProfiles = specialProfilesText
          .split('\n')
          .map(name => name.trim())
          .filter(name => name.length > 0);
        
        // Save to storage
        chrome.storage.local.set({
          peopleSheetId: peopleSheetId,
          logSheetId: logSheetId,
          specialProfiles: specialProfiles
        }, function() {
          showStatusMessage('Settings saved successfully!', 'success');
          document.body.removeChild(settingsDialog);
          
          // Reload extension to apply new settings after a short delay
          setTimeout(function() {
            chrome.runtime.reload();
          }, 1000);
        });
      });
    }
  }
  
  function openHistoryPage() {
    // Open the log sheet directly
    chrome.storage.local.get(['logSheetId'], (result) => {
      if (result.logSheetId) {
        const logSheetUrl = `https://docs.google.com/spreadsheets/d/${result.logSheetId}`;
        chrome.tabs.create({ url: logSheetUrl });
      } else {
        showStatusMessage('Log Sheet ID not set', 'error');
      }
    });
  }
  
  function shortenUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname.substring(0, 15) + (urlObj.pathname.length > 15 ? '...' : '');
    } catch (e) {
      return url.substring(0, 30) + (url.length > 30 ? '...' : '');
    }
  }
  
  function showStatusMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = '';
    statusMessage.classList.add(type);
    statusMessage.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 3000);
  }
  
  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'navigateToProfile' && request.index !== undefined) {
      if (!isNavigating) {
        isNavigating = true;
        navigateToProfile(request.index);
        setTimeout(() => { isNavigating = false; }, 200);
      }
    }
  });
});
