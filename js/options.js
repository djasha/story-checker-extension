// Options page script for Story Checker extension
document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const peopleSheetIdInput = document.getElementById('peopleSheetId');
  const logSheetIdInput = document.getElementById('logSheetId');
  const specialProfilesInput = document.getElementById('specialProfiles');
  const saveButton = document.getElementById('save-button');
  const statusDiv = document.getElementById('status');
  
  let currentUserEmail = null;
  
  // Load saved settings
  chrome.storage.local.get(['peopleSheetId', 'logSheetId', 'specialProfiles', 'currentUserEmail'], (result) => {
    currentUserEmail = result.currentUserEmail;
    
    if (result.peopleSheetId) {
      peopleSheetIdInput.value = result.peopleSheetId;
    }
    if (result.logSheetId) {
      logSheetIdInput.value = result.logSheetId;
    }
    if (result.specialProfiles) {
      specialProfilesInput.value = result.specialProfiles.join('\n');
    }
    
    // Show which account is logged in
    if (currentUserEmail) {
      showStatus(`Logged in as: ${currentUserEmail}`, 'success');
    }
  });
  
  // Save settings
  saveButton.addEventListener('click', () => {
    const peopleSheetId = peopleSheetIdInput.value.trim();
    const logSheetId = logSheetIdInput.value.trim();
    const specialProfilesText = specialProfilesInput.value;
    
    // Parse special profiles - one per line, remove empty lines
    const specialProfiles = specialProfilesText
      .split('\n')
      .map(name => name.trim())
      .filter(name => name.length > 0);
    
    // Validate inputs
    if (!peopleSheetId || !logSheetId) {
      showStatus('Please enter both Sheet IDs', 'error');
      return;
    }
    
    // Prepare data to save
    const settingsData = { 
      peopleSheetId: peopleSheetId, 
      logSheetId: logSheetId,
      specialProfiles: specialProfiles
    };
    
    // Also save per-user settings if we have user email
    if (currentUserEmail) {
      const userSettingsKey = `userSettings_${currentUserEmail}`;
      settingsData[userSettingsKey] = {
        peopleSheetId: peopleSheetId,
        logSheetId: logSheetId,
        specialProfiles: specialProfiles
      };
    }
    
    // Save to storage
    chrome.storage.local.set(settingsData, () => {
      showStatus('Settings saved successfully!', 'success');
      
      // Reload the extension to apply new settings
      setTimeout(() => {
        chrome.runtime.reload();
      }, 1500);
    });
  });
  
  // Helper to show status messages
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'block';
    
    // Hide after 5 seconds (longer for account info)
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }
});
