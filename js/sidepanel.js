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
  const profilesSheetButton = document.getElementById('profiles-sheet-button');
  const statusMessage = document.getElementById('status-message');
  const loadMoreContainer = document.getElementById('load-more-container');
  const loadMoreButton = document.getElementById('load-more-button');
  const filterNoButton = document.getElementById('filter-no-button');
  
  // Create preload counter element
  const preloadCounter = document.createElement('span');
  preloadCounter.id = 'preload-counter';
  preloadCounter.style.display = 'inline-block';
  preloadCounter.style.marginLeft = '5px';
  preloadCounter.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
  preloadCounter.style.color = 'white';
  preloadCounter.style.borderRadius = '50%';
  preloadCounter.style.width = '20px';
  preloadCounter.style.height = '20px';
  preloadCounter.style.fontSize = '12px';
  preloadCounter.style.lineHeight = '20px';
  preloadCounter.style.textAlign = 'center';
  preloadCounter.textContent = '0';
  
  // Main action elements
  const currentProfileElement = document.getElementById('current-profile');
  const currentUrlElement = document.getElementById('current-url');
  const yesButton = document.getElementById('yes-button');
  const noButton = document.getElementById('no-button');
  const openButton = document.getElementById('open-button');
  const preloadButton = document.getElementById('preload-button');
  
  // Preload options elements
  const preloadOptions = document.getElementById('preload-options');
  const preloadAmountButtons = document.querySelectorAll('.preload-amount button');
  const startPreloadButton = document.getElementById('start-preload-button');
  
  // Keep track of last check date for grouping
  let lastCheckDate = null;
  
  // Global profiles data
  let allProfiles = [];
  let profiles = [];
  let filteredProfiles = []; // For filtered view (NO only)
  let currentProfileIndex = -1; // No profile selected initially
  let currentPage = 0;
  let pageSize = 10; // Show more profiles per page
  let preloadedUrls = new Set();
  let preloadAmount = 5;
  let preloadTab = null;
  let showNoOnly = false; // Filter toggle state
  
  // Profile choice tracking
  let profileChoices = {};
  
  // Save current state when closing panel
  window.addEventListener('beforeunload', () => {
    // Save current state and profile choices
    chrome.storage.local.set({
      sidebarState: {
        profiles: profiles,
        currentProfileIndex: currentProfileIndex,
        currentPage: currentPage,
        preloadedUrls: Array.from(preloadedUrls)
      },
      profileChoices: profileChoices // Save profile choices separately for persistence
    });
  });
  
  // Check auth status on load
  checkAuthStatus();
  
  // Add preload counter to preload button
  preloadButton.appendChild(preloadCounter);
  
  // Set up event listeners
  authButton.addEventListener('click', authenticateWithGoogle);
  reloadButton.addEventListener('click', loadAllProfiles);
  settingsButton.addEventListener('click', openOptionsPage);
  historyButton.addEventListener('click', openHistorySheet);
  profilesSheetButton.addEventListener('click', openProfilesSheet);
  yesButton.addEventListener('click', () => currentProfileIndex >= 0 && logChoice(currentProfileIndex, 'YES'));
  noButton.addEventListener('click', () => currentProfileIndex >= 0 && logChoice(currentProfileIndex, 'NO'));
  openButton.addEventListener('click', () => currentProfileIndex >= 0 && openProfile(currentProfileIndex));
  loadMoreButton.addEventListener('click', loadMoreProfiles);
  preloadButton.addEventListener('click', togglePreloadOptions);
  startPreloadButton.addEventListener('click', startPreloading);
  filterNoButton.addEventListener('click', toggleNoFilter);
  
  // Set up preload amount selection
  preloadAmountButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Update active state
      preloadAmountButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Update amount
      preloadAmount = parseInt(button.dataset.amount);
      startPreloadButton.textContent = `Preload ${preloadAmount} Profiles`;
    });
  });
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', handleKeyPress);
  
  // Functions
  function checkAuthStatus() {
    chrome.storage.local.get(['authToken', 'profileChoices', 'sidebarState'], (result) => {
      if (result.authToken) {
        authStatus.textContent = 'Authenticated ✓';
        authStatus.classList.add('success');
        authSection.style.display = 'none';
        profilesSection.style.display = 'block';
        
        // Load saved choices
        if (result.profileChoices) {
          profileChoices = result.profileChoices;
          console.log('Loaded profileChoices from storage:', profileChoices);
        }
        
        // Restore previous state if available
        if (result.sidebarState) {
          restorePreviousState(result.sidebarState);
        } else {
          // Load fresh data if no state saved
          loadAllProfilesWithoutReset();
        }
      } else {
        authStatus.textContent = 'Please authenticate to get started';
        authStatus.classList.remove('success');
        authSection.style.display = 'block';
        profilesSection.style.display = 'none';
      }
    });
  }
  
  function restorePreviousState(state) {
    // Restore profiles
    if (state.profiles && state.profiles.length > 0) {
      profiles = state.profiles;
      displayProfiles(profiles);
      
      // Restore current profile index
      if (state.currentProfileIndex >= 0 && state.currentProfileIndex < profiles.length) {
        selectProfile(state.currentProfileIndex);
      }
      
      // Restore current page
      currentPage = state.currentPage || 0;
      
      // Restore preloaded URLs
      if (state.preloadedUrls) {
        preloadedUrls = new Set(state.preloadedUrls);
        preloadCounter.textContent = preloadedUrls.size; // Update counter
      }
      
      showStatusMessage('Restored previous session', 'success');
    } else {
      // Fall back to loading fresh data
      loadAllProfiles();
    }
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
        loadAllProfiles();
      } else {
        const error = response ? response.error : 'Unknown error';
        authStatus.textContent = `Authentication failed: ${error}`;
        authStatus.classList.add('error');
      }
    });
  }
  
  function loadAllProfiles() {
    showStatusMessage('Loading profiles...', 'info');
    profilesList.innerHTML = '<p>Loading profiles...</p>';
    loadMoreContainer.style.display = 'none';
    
    // Reset profile choices to clear all YES/NO colors
    profileChoices = {};
    chrome.storage.local.remove(['profileChoices']);
    console.log('Cleared profileChoices during reload');
    
    // Reset filter as well
    showNoOnly = false;
    filterNoButton.classList.remove('active');
    
    chrome.runtime.sendMessage({ action: 'fetchProfiles' }, (response) => {
      if (response && response.success) {
        // Store all profiles but only display the first page
        allProfiles = response.profiles;
        currentPage = 0;
        preloadedUrls.clear(); // Reset preloaded URLs
        preloadCounter.textContent = '0'; // Reset counter
        
        // Display first page
        profiles = allProfiles.slice(0, pageSize);
        displayProfiles(profiles);
        
        // Show load more button if there are more profiles
        if (allProfiles.length > pageSize) {
          loadMoreContainer.style.display = 'block';
        }
        
        showStatusMessage(`Loaded ${allProfiles.length} profiles`, 'success');
        
        // Enable preload button if we have profiles
        if (allProfiles.length > 0) {
          preloadButton.disabled = false;
        }
      } else {
        const error = response ? response.error : 'Unknown error';
        profilesList.innerHTML = `<p class="error-text">Error loading profiles: ${error}</p>`;
        showStatusMessage(`Error: ${error}`, 'error');
      }
    });
  }
  
  function loadMoreProfiles() {
    // Return a promise so we can chain actions after loading more profiles
    return new Promise(resolve => {
      currentPage++;
      const startIndex = currentPage * pageSize;
      const endIndex = startIndex + pageSize;
      const newProfiles = allProfiles.slice(startIndex, endIndex);
      
      // Add new profiles to the existing ones
      profiles = [...profiles, ...newProfiles];
      
      // Display all profiles (including the new ones)
      displayProfiles(profiles);
      
      // Hide load more button if we've loaded all profiles
      if (endIndex >= allProfiles.length) {
        loadMoreContainer.style.display = 'none';
      }
      
      showStatusMessage(`Loaded ${profiles.length} of ${allProfiles.length} profiles`, 'info');
      
      // Resolve the promise to signal completion
      resolve();
    });
  }
  
  function displayProfiles(profilesToDisplay) {
    if (!profilesToDisplay || profilesToDisplay.length === 0) {
      profilesList.innerHTML = '<p>No profiles found' + (showNoOnly ? ' marked as NO' : '') + '. Please check your Google Sheet.</p>';
      return;
    }
    
    // Clear existing profiles
    profilesList.innerHTML = '';
    
    // Create profile items with selection functionality
    profilesToDisplay.forEach((profile, index) => {
      const profileItem = document.createElement('div');
      profileItem.className = 'profile-item';
      profileItem.dataset.index = index;
      profileItem.dataset.url = profile.url;
      
      // Apply color based on previous choice
      if (profileChoices[profile.url]) {
        profileItem.classList.add(profileChoices[profile.url].toLowerCase());
      }
      
      // Mark as preloaded if it's in the preloaded URLs set
      if (preloadedUrls.has(profile.url)) {
        profileItem.classList.add('preloaded');
      }
      
      profileItem.innerHTML = `
        <div class="profile-info">
          <div class="profile-name">${profile.name}</div>
          <div class="profile-url">${profile.platform}: ${shortenUrl(profile.url)}</div>
        </div>
      `;
      
      // Make the entire profile item clickable for selection
      profileItem.addEventListener('click', () => selectProfile(index));
      
      profilesList.appendChild(profileItem);
    });
    
    // Select the first profile by default if available
    if (profilesToDisplay.length > 0) {
      selectProfile(0);
    }
  }
  
  // Select a profile and update the UI
  function selectProfile(index) {
    // Make sure index is within bounds
    if (index < 0 || index >= profiles.length) return;
    
    // Deselect all profiles
    const allProfileItems = profilesList.querySelectorAll('.profile-item');
    allProfileItems.forEach(item => item.classList.remove('active'));
    
    // Select the clicked profile
    const selectedItem = profilesList.querySelector(`.profile-item[data-index="${index}"]`);
    if (selectedItem) {
      selectedItem.classList.add('active');
      
      // Update current profile display
      currentProfileIndex = index;
      const profile = profiles[index];
      
      currentProfileElement.textContent = profile.name;
      currentUrlElement.textContent = `${profile.platform}: ${profile.url}`;
      
      // Update color based on previous choice
      updateProfileStatusColor(profile.url);
      
      // Enable buttons
      yesButton.disabled = false;
      noButton.disabled = false;
      openButton.disabled = false;
      preloadButton.disabled = false;
      
      // Removed auto-scrolling as requested by user
      // We don't want the sidebar to scroll automatically
    }
  }
  
  // Update profile name color based on choice
  function updateProfileStatusColor(url) {
    // Reset classes
    currentProfileElement.classList.remove('yes', 'no');
    
    // Add appropriate class if a choice exists
    if (profileChoices[url]) {
      currentProfileElement.classList.add(profileChoices[url].toLowerCase());
      
      // Also update the profile item in the list
      const profileItem = profilesList.querySelector(`.profile-item[data-url="${url}"]`);
      if (profileItem) {
        profileItem.classList.remove('yes', 'no');
        profileItem.classList.add(profileChoices[url].toLowerCase());
      }
    }
  }
  
  // Direct profile opening function that takes a profile object
  function openProfileDirect(profile) {
    if (!profile || !profile.url) {
      console.error('Invalid profile provided to openProfileDirect', profile);
      return;
    }
    
    // Show the profile being opened
    showStatusMessage(`Opening ${profile.name}'s profile...`, 'info');
    
    chrome.runtime.sendMessage(
      { 
        action: 'openProfile',
        url: profile.url,
        name: profile.name,
        platform: profile.platform
      }, 
      (response) => {
        if (!response || !response.success) {
          const error = response ? response.error : 'Unknown error';
          showStatusMessage(`Error opening profile: ${error}`, 'error');
        } else {
          // Add to preloaded URLs set
          preloadedUrls.add(profile.url);
          
          // Mark as preloaded in UI
          const profileItem = profilesList.querySelector(`.profile-item[data-url="${profile.url}"]`);
          if (profileItem) {
            profileItem.classList.add('preloaded');
          }
        }
      }
    );
  }
  
  // Standard profile opening function that takes an index
  function openProfile(index) {
    // Validate the index is in range
    if (index < 0 || index >= profiles.length) {
      console.error(`Invalid profile index: ${index}, max: ${profiles.length - 1}`);
      return;
    }
    
    const profile = profiles[index];
    openProfileDirect(profile);
  }
  
  function logChoice(index, choice) {
    const profile = profiles[index];
    const timestamp = new Date().toISOString();
    
    // Update the UI to show logging in progress
    showStatusMessage(`Logging ${choice} for ${profile.name}...`, 'info');
    
    chrome.runtime.sendMessage(
      {
        action: 'logChoice',
        profile: profile,
        choice: choice,
        timestamp: timestamp
      },
      (response) => {
        if (response && response.success) {
          showStatusMessage(`Logged ${choice} for ${profile.name}`, 'success');
          
          // Store the choice in memory and update UI
          profileChoices[profile.url] = choice;
          updateProfileStatusColor(profile.url);
          
          // Store choices in Chrome storage to persist between sessions
          chrome.storage.local.set({ profileChoices: profileChoices });
          console.log('Saved profileChoices to Chrome storage:', profileChoices);
          
          // Check if we need to add a date separator
          const today = new Date().toDateString();
          if (lastCheckDate !== today) {
            chrome.runtime.sendMessage(
              {
                action: 'addDateSeparator',
                date: today
              }
            );
            lastCheckDate = today;
          }
          
          // Always move to next profile after logging a choice - INSTANTLY
          if (index < profiles.length - 1) {
            // Store the current index to ensure we move to the next one
            const nextIndex = index + 1;
            
            // First select the next profile
            selectProfile(nextIndex);
            
            // Then open it immediately, but make sure we're using the right index
            // by directly referencing the profile rather than using the currentProfileIndex
            const nextProfile = profiles[nextIndex];
            openProfileDirect(nextProfile);
          } else if (profiles.length < allProfiles.length) {
            // We've reached the end of the currently loaded profiles
            // but there are more profiles available - load more automatically
            loadMoreProfiles().then(() => {
              // After loading more profiles, go to the first newly loaded profile
              const nextIndex = index + 1; // This will be the first profile in the new batch
              selectProfile(nextIndex);
              
              const nextProfile = profiles[nextIndex];
              openProfileDirect(nextProfile);
            });
          }
        } else {
          const error = response ? response.error : 'Unknown error';
          showStatusMessage(`Error logging choice: ${error}`, 'error');
        }
      }
    );
  }
  
  function handleKeyPress(e) {
    // Only process if profiles are loaded
    if (profiles.length === 0) return;
    
    switch(e.key) {
      case 'y':
      case 'Y':
        // Log YES for current profile
        if (currentProfileIndex >= 0) logChoice(currentProfileIndex, 'YES');
        break;
      case 'n':
      case 'N':
        // Log NO for current profile  
        if (currentProfileIndex >= 0) logChoice(currentProfileIndex, 'NO');
        break;
      case 'ArrowDown':
      case 'j':
        // Next profile
        if (currentProfileIndex < profiles.length - 1) {
          selectProfile(currentProfileIndex + 1);
        }
        break;
      case 'ArrowUp':
      case 'k':
        // Previous profile
        if (currentProfileIndex > 0) {
          selectProfile(currentProfileIndex - 1);
        }
        break;
      case 'r':
      case 'R':
        // Reload profiles
        loadAllProfiles();
        break;
      case 'o':
      case 'O':
        // Open current profile
        if (currentProfileIndex >= 0) openProfile(currentProfileIndex);
        break;
    }
  }
  
  function openOptionsPage() {
    // Open options page in a new tab instead of using chrome.runtime.openOptionsPage()
    // which might not be working correctly
    const optionsUrl = chrome.runtime.getURL('options.html');
    chrome.tabs.create({ url: optionsUrl });
  }
  
  function openHistorySheet() {
    chrome.storage.local.get(['logSheetId'], (result) => {
      if (result.logSheetId) {
        const url = `https://docs.google.com/spreadsheets/d/${result.logSheetId}/edit`;
        chrome.tabs.create({ url });
      } else {
        showStatusMessage('Log Sheet ID not set', 'error');
      }
    });
  }
  
  function openProfilesSheet() {
    chrome.storage.local.get(['peopleSheetId'], (result) => {
      if (result.peopleSheetId) {
        const url = `https://docs.google.com/spreadsheets/d/${result.peopleSheetId}/edit`;
        chrome.tabs.create({ url });
      } else {
        showStatusMessage('People Sheet ID not set', 'error');
      }
    });
  }
  
  function togglePreloadOptions() {
    preloadOptions.classList.toggle('active');
    if (preloadOptions.classList.contains('active')) {
      preloadButton.textContent = 'Hide Options';
    } else {
      preloadButton.textContent = 'Preload';
    }
  }
  
  function startPreloading() {
    // No need to cancel tab-based preloading since we use fetch now
    
    // Calculate which profiles to preload
    const profilesToPreload = [];
    let count = 0;
    
    // First look at profiles already displayed but not preloaded
    for (let i = 0; i < profiles.length && count < preloadAmount; i++) {
      if (!preloadedUrls.has(profiles[i].url)) {
        profilesToPreload.push(profiles[i]);
        count++;
      }
    }
    
    // If we need more, look at profiles not yet displayed
    if (count < preloadAmount && profiles.length < allProfiles.length) {
      const startIndex = profiles.length;
      const neededProfiles = preloadAmount - count;
      const endIndex = Math.min(startIndex + neededProfiles, allProfiles.length);
      
      for (let i = startIndex; i < endIndex; i++) {
        if (!preloadedUrls.has(allProfiles[i].url)) {
          profilesToPreload.push(allProfiles[i]);
        }
      }
    }
    
    // Start preloading
    if (profilesToPreload.length > 0) {
      showStatusMessage(`Preloading ${profilesToPreload.length} profiles...`, 'info');
      preloadProfiles(profilesToPreload);
    } else {
      showStatusMessage('No profiles left to preload', 'info');
    }
    
    // Hide preload options
    preloadOptions.classList.remove('active');
    preloadButton.textContent = 'Preload';
  }
  
  function preloadProfiles(profilesToPreload) {
    let currentIndex = 0;
    const total = profilesToPreload.length;
    
    showStatusMessage(`Starting background preload of ${total} profiles...`, 'info');
    
    // Instead of creating a visible tab, use fetch requests to preload profiles
    function preloadNext() {
      if (currentIndex < total) {
        const profile = profilesToPreload[currentIndex];
        showStatusMessage(`Preloading ${currentIndex + 1}/${total}: ${profile.name}...`, 'info');
        
        // Preload by using a fetch request instead of opening a tab
        fetch(profile.url, { 
          method: 'GET',
          credentials: 'include' // This ensures cookies are sent with the request
        })
        .then(() => {
          // Mark as preloaded whether fetch succeeds or fails
          // (we just want to warm the browser cache)
          preloadedUrls.add(profile.url);
          
          // Update profile item in UI
          const profileItem = profilesList.querySelector(`.profile-item[data-url="${profile.url}"]`);
          if (profileItem) {
            profileItem.classList.add('preloaded');
          }
          
          // Update the preload counter
          preloadCounter.textContent = preloadedUrls.size;
          
          // Go to next profile
          currentIndex++;
          setTimeout(preloadNext, 800); // Slightly faster between requests
        })
        .catch(err => {
          console.log(`Error preloading ${profile.url}:`, err);
          // Still continue to the next profile even if this one failed
          currentIndex++;
          setTimeout(preloadNext, 800);
        });
      } else {
        // All done!
        showStatusMessage(`Preloaded ${total} profiles successfully!`, 'success');
      }
    }
    
    // Start preloading immediately
    preloadNext();
  }
  
  function shortenUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname.substring(0, 15) + (urlObj.pathname.length > 15 ? '...' : '');
    } catch (e) {
      return url.substring(0, 30) + (url.length > 30 ? '...' : '');
    }
  }
  
  // Load all profiles without resetting profile choices
  function loadAllProfilesWithoutReset() {
    showStatusMessage('Loading profiles...', 'info');
    profilesList.innerHTML = '<p>Loading profiles...</p>';
    loadMoreContainer.style.display = 'none';
    
    // Don't reset profile choices - just fetch profiles
    chrome.runtime.sendMessage({ action: 'fetchProfiles' }, (response) => {
      if (response && response.success) {
        // Store all profiles but only display the first page
        allProfiles = response.profiles;
        currentPage = 0;
        
        // We keep preloadedUrls but update the counter
        preloadCounter.textContent = preloadedUrls.size;
        
        // Display first page
        profiles = allProfiles.slice(0, pageSize);
        displayProfiles(profiles);
        
        // Show load more button if there are more profiles
        if (allProfiles.length > pageSize) {
          loadMoreContainer.style.display = 'block';
        }
        
        showStatusMessage(`Loaded ${allProfiles.length} profiles with preserved choices`, 'success');
        
        // Enable preload button if we have profiles
        if (allProfiles.length > 0) {
          preloadButton.disabled = false;
        }
      } else {
        const error = response ? response.error : 'Unknown error';
        profilesList.innerHTML = `<p class="error-text">Error loading profiles: ${error}</p>`;
        showStatusMessage(`Error: ${error}`, 'error');
      }
    });
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
  
  // Toggle NO filter to show only profiles marked as NO
  function toggleNoFilter() {
    showNoOnly = !showNoOnly;
    
    // Toggle active state of the button
    if (showNoOnly) {
      filterNoButton.classList.add('active');
      filterNoButton.textContent = 'Show All';
      
      // Filter profiles to show only NO
      applyNoFilter();
    } else {
      filterNoButton.classList.remove('active');
      filterNoButton.textContent = 'Show NO';
      
      // Reset to show all profiles
      profiles = [...allProfiles].slice(0, pageSize * (currentPage + 1));
      displayProfiles(profiles);
      
      // Show load more button if not all profiles are loaded
      if (profiles.length < allProfiles.length) {
        loadMoreContainer.style.display = 'block';
      }
    }
    
    showStatusMessage(showNoOnly ? 'Showing NO profiles only' : 'Showing all profiles', 'info');
  }
  
  // Apply filter to show only NO profiles
  function applyNoFilter() {
    // Get profile URLs marked as NO
    const noProfiles = Object.entries(profileChoices)
      .filter(([url, choice]) => choice === 'NO')
      .map(([url]) => url);
    
    if (noProfiles.length === 0) {
      profiles = [];
      displayProfiles(profiles);
      loadMoreContainer.style.display = 'none';
      showStatusMessage('No profiles marked as NO yet', 'info');
      return;
    }
    
    // Filter all profiles to only include those marked as NO
    profiles = allProfiles.filter(profile => noProfiles.includes(profile.url));
    displayProfiles(profiles);
    
    // No need for load more when filtering
    loadMoreContainer.style.display = 'none';
    
    showStatusMessage(`Found ${profiles.length} profiles marked as NO`, 'success');
  }
});
