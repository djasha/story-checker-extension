// Main popup script for Story Checker extension
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const authButton = document.getElementById('auth-button');
  const authStatus = document.getElementById('auth-status');
  const authSection = document.getElementById('auth-section');
  const mainSection = document.getElementById('main-section');
  const currentProfile = document.getElementById('current-profile');
  const progressLabel = document.getElementById('progress-label');
  const yesButton = document.getElementById('yes-button');
  const noButton = document.getElementById('no-button');
  const skipButton = document.getElementById('skip-button');
  const reloadButton = document.getElementById('reload-button');
  const historyButton = document.getElementById('history-button');
  const settingsButton = document.getElementById('settings-button');
  const historyPanel = document.getElementById('history-panel');
  const historyList = document.getElementById('history-list');
  const statusMessage = document.getElementById('status-message');

  // Application state
  let state = {
    currentIndex: 0,
    profiles: [],
    checkedProfiles: {},
    isAuthenticated: false
  };

  // Initialize the extension
  function initialize() {
    // Check if user is authenticated with Google
    chrome.storage.local.get(['authToken', 'checkedProfiles'], (result) => {
      if (result.authToken) {
        state.isAuthenticated = true;
        state.checkedProfiles = result.checkedProfiles || {};
        
        // Switch to main UI
        authSection.style.display = 'none';
        mainSection.style.display = 'block';
        
        // Load profiles from Google Sheets
        loadProfiles();
      } else {
        authStatus.textContent = 'Please connect to Google Sheets to start';
      }
    });
  }

  // Load profiles from Google Sheets
  function loadProfiles() {
    statusMessage.textContent = 'Loading profiles from Google Sheets...';
    
    // Send message to background script to fetch profiles
    chrome.runtime.sendMessage({ action: 'fetchProfiles' }, (response) => {
      if (response.success) {
        state.profiles = response.profiles;
        updateHistoryPanel();
        navigateToNext();
        statusMessage.textContent = 'Profiles loaded successfully';
      } else {
        statusMessage.textContent = 'Error: ' + response.error;
      }
    });
  }

  // Navigate to the next profile
  function navigateToNext() {
    if (state.currentIndex < state.profiles.length) {
      const profile = state.profiles[state.currentIndex];
      currentProfile.textContent = `${profile.name}'s ${profile.platform}`;
      progressLabel.textContent = `Profile ${state.currentIndex + 1} of ${state.profiles.length}`;
      
      // Open the profile URL in a new tab or update existing tab
      chrome.runtime.sendMessage({ 
        action: 'openProfile', 
        url: profile.url,
        name: profile.name,
        platform: profile.platform
      });
      
      // Enable buttons
      yesButton.disabled = false;
      noButton.disabled = false;
      skipButton.disabled = false;
    } else {
      // All profiles checked
      currentProfile.textContent = 'All Done!';
      progressLabel.textContent = `Completed all ${state.profiles.length} profiles`;
      statusMessage.textContent = 'Finished checking all profiles';
      
      // Disable buttons
      yesButton.disabled = true;
      noButton.disabled = true;
      skipButton.disabled = true;
    }
  }

  // Log a choice (YES/NO) for the current profile
  function logChoice(choice) {
    if (state.currentIndex < state.profiles.length) {
      const profile = state.profiles[state.currentIndex];
      const timestamp = new Date().toISOString();
      const profileKey = `${profile.name}_${profile.platform}`;
      
      // Update local checked profiles history
      state.checkedProfiles[profileKey] = {
        timestamp: timestamp,
        choice: choice,
        platform: profile.platform
      };
      
      // Save to storage
      chrome.storage.local.set({ checkedProfiles: state.checkedProfiles });
      
      // Update UI
      updateHistoryPanel();
      
      // Log to Google Sheets if YES
      if (choice === 'YES') {
        statusMessage.textContent = `Logging YES for ${profile.name}...`;
        
        // Log both Instagram and Facebook if available
        chrome.runtime.sendMessage({ 
          action: 'logChoice', 
          profile: profile,
          choice: choice,
          timestamp: timestamp
        }, (response) => {
          if (response.success) {
            statusMessage.textContent = `Logged ${choice} for ${profile.name}`;
          } else {
            statusMessage.textContent = 'Error logging choice: ' + response.error;
          }
        });
      } else {
        statusMessage.textContent = `Skipped logging for ${profile.name} (${choice})`;
      }
      
      // Move to next profile
      state.currentIndex++;
      navigateToNext();
    }
  }

  // Update the history panel with checked profiles
  function updateHistoryPanel() {
    // Clear existing items
    historyList.innerHTML = '';
    
    // Add a label for each profile
    state.profiles.forEach((profile, index) => {
      const profileKey = `${profile.name}_${profile.platform}`;
      const div = document.createElement('div');
      div.textContent = `${profile.name} (${profile.platform})`;
      div.classList.add('history-item');
      
      // Style based on checked status
      if (profileKey in state.checkedProfiles) {
        const result = state.checkedProfiles[profileKey];
        if (result.choice === 'YES') {
          div.classList.add('history-yes');
        } else {
          div.classList.add('history-no');
        }
      } else {
        div.classList.add('history-pending');
      }
      
      // Add click handler to jump to profile
      div.addEventListener('click', () => {
        state.currentIndex = index;
        navigateToNext();
        statusMessage.textContent = `Jumped to ${profile.name}`;
      });
      
      historyList.appendChild(div);
    });
  }

  // Event listeners
  authButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
      if (response.success) {
        authStatus.textContent = 'Authentication successful!';
        state.isAuthenticated = true;
        
        // Switch to main UI
        setTimeout(() => {
          authSection.style.display = 'none';
          mainSection.style.display = 'block';
          loadProfiles();
        }, 1000);
      } else {
        authStatus.textContent = 'Authentication failed: ' + response.error;
      }
    });
  });

  yesButton.addEventListener('click', () => logChoice('YES'));
  noButton.addEventListener('click', () => logChoice('NO'));
  skipButton.addEventListener('click', () => {
    state.currentIndex++;
    navigateToNext();
  });

  reloadButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'reloadTab' });
    statusMessage.textContent = 'Reloading current page...';
  });

  historyButton.addEventListener('click', () => {
    if (historyPanel.style.display === 'none') {
      historyPanel.style.display = 'block';
      updateHistoryPanel();
      historyButton.textContent = '📋 Hide History';
    } else {
      historyPanel.style.display = 'none';
      historyButton.textContent = '📋 History';
    }
  });

  settingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'y' || e.key === 'Y') {
      yesButton.click();
    } else if (e.key === 'n' || e.key === 'N') {
      noButton.click();
    } else if (e.key === 's' || e.key === 'S') {
      skipButton.click();
    } else if (e.key === 'r' || e.key === 'R') {
      reloadButton.click();
    }
  });

  // Initialize the extension
  initialize();
});
