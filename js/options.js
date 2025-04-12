// Options page script for Story Checker extension
document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const peopleSheetIdInput = document.getElementById('peopleSheetId');
  const logSheetIdInput = document.getElementById('logSheetId');
  const saveButton = document.getElementById('save-button');
  const statusDiv = document.getElementById('status');
  
  // Load saved settings
  chrome.storage.local.get(['peopleSheetId', 'logSheetId'], (result) => {
    if (result.peopleSheetId) {
      peopleSheetIdInput.value = result.peopleSheetId;
    }
    if (result.logSheetId) {
      logSheetIdInput.value = result.logSheetId;
    }
  });
  
  // Save settings
  saveButton.addEventListener('click', () => {
    const peopleSheetId = peopleSheetIdInput.value.trim();
    const logSheetId = logSheetIdInput.value.trim();
    
    // Validate inputs
    if (!peopleSheetId || !logSheetId) {
      showStatus('Please enter both Sheet IDs', 'error');
      return;
    }
    
    // Save to storage
    chrome.storage.local.set(
      { 
        peopleSheetId: peopleSheetId, 
        logSheetId: logSheetId 
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
