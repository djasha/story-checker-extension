// Options page script for Story Checker extension
document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const peopleSheetIdInput = document.getElementById('peopleSheetId');
  const logSheetIdInput = document.getElementById('logSheetId');
  const specialProfilesInput = document.getElementById('specialProfiles');
  const saveButton = document.getElementById('save-button');
  const statusDiv = document.getElementById('status');
  
  // Load saved settings
  chrome.storage.local.get(['peopleSheetId', 'logSheetId', 'specialProfiles'], (result) => {
    if (result.peopleSheetId) {
      peopleSheetIdInput.value = result.peopleSheetId;
    }
    if (result.logSheetId) {
      logSheetIdInput.value = result.logSheetId;
    }
    if (result.specialProfiles) {
      specialProfilesInput.value = result.specialProfiles.join('\n');
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
    
    // Save to storage
    chrome.storage.local.set(
      { 
        peopleSheetId: peopleSheetId, 
        logSheetId: logSheetId,
        specialProfiles: specialProfiles
      },
      () => {
        showStatus('Settings saved successfully!', 'success');
        
        // Reload the extension to apply new settings
        setTimeout(() => {
          chrome.runtime.reload();
        }, 1500);
      }
    );
  });
  
  // Helper to show status messages
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
});
