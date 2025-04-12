// Background script for Story Checker extension
// Handles Google Sheets API integration and tab management

// Constants
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const TAB_STORAGE_KEY = 'story_checker_tab';
const PEOPLE_SHEET_ID = '1UJ99bEedIu5OEtWXDWM50XiAkT_puxaQ253XVeTBAqQ';
const LOG_SHEET_ID = '1M2yMVO4vuRS0VXpJeI7ZPSH4wIcoQhCAlJ3q3Liw1wc';
const PRELOAD_COUNT = 10; // Number of profiles to preload in advance
const PROFILE_SWITCH_DELAY = 100; // Reduced delay for profile switching

// State
let storyCheckerTab = null;
let preloadedTabs = {};
let currentProfileIndex = 0;
let allProfiles = [];
let specialProfiles = new Set();

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log('Story Checker extension installed');
  // Set the sheet IDs
  chrome.storage.local.set({
    peopleSheetId: PEOPLE_SHEET_ID,
    logSheetId: LOG_SHEET_ID
  }, () => {
    console.log('Sheet IDs set successfully');
  });
  
  // Load special profiles on startup
  chrome.storage.local.get(['specialProfiles'], (result) => {
    if (result.specialProfiles) {
      specialProfiles = new Set(result.specialProfiles);
    }
  });
});

// Initialize side panel when browser loads
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Keep track of the last check date to add separators
let lastCheckDate = null;

// Listen for messages from the popup and side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background script received message:', request);
  
  switch (request.action) {
    case 'authenticate':
      authenticateWithGoogle(sendResponse);
      return true; // Keep the message channel open for async response
      
    case 'fetchProfiles':
      fetchProfiles(sendResponse);
      return true;
      
    case 'openProfile':
      openProfile(request.url, request.name, request.platform, request.index, sendResponse);
      return true;
      
    case 'preloadProfiles':
      preloadProfiles(request.profiles, request.currentIndex);
      sendResponse({ success: true });
      return true;
      
    case 'logChoice':
      logChoice(request.profile, request.choice, request.timestamp, sendResponse);
      return true;
      
    case 'reloadTab':
      reloadStoryCheckerTab(sendResponse);
      return true;
      
    case 'addDateSeparator':
      addDateSeparator(request.date);
      return false; // No response needed
  }
});

// Authenticate with Google using simpler chrome.identity.getAuthToken API
function authenticateWithGoogle(sendResponse) {
  console.log('Starting authentication using chrome.identity.getAuthToken...');
  
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError) {
      console.error('Authentication error:', chrome.runtime.lastError);
      sendResponse({ 
        success: false, 
        error: chrome.runtime.lastError.message || 'Authentication failed'
      });
      return;
    }
    
    if (!token) {
      console.error('No token returned');
      sendResponse({ success: false, error: 'No auth token returned' });
      return;
    }
    
    console.log('Authentication successful!');
    
    // Store the token
    chrome.storage.local.set({ authToken: token }, () => {
      console.log('Access token stored successfully');
      sendResponse({ success: true });
    });
  });
}

// Fetch profiles from Google Sheets
function fetchProfiles(sendResponse) {
  // Get a fresh token just to be sure
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (chrome.runtime.lastError || !token) {
      console.error('Token retrieval error:', chrome.runtime.lastError);
      sendResponse({ 
        success: false, 
        error: 'Authentication error: ' + (chrome.runtime.lastError?.message || 'No token available') 
      });
      return;
    }
    
    // Store the refreshed token
    chrome.storage.local.set({ authToken: token });
    
    // Get the sheet ID
    chrome.storage.local.get(['peopleSheetId'], async (result) => {
      if (!result.peopleSheetId) {
        sendResponse({ success: false, error: 'People Sheet ID not set' });
        return;
      }
      
      try {
        console.log('Fetching profiles from sheet:', result.peopleSheetId);
        
        // Fetch the people list from Google Sheets
        const response = await fetch(
          `${SHEETS_API_BASE}/${result.peopleSheetId}/values/A:C?majorDimension=ROWS`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.values || data.values.length < 2) {
          sendResponse({ success: false, error: 'Sheet is empty or has insufficient data' });
          return;
        }
        
        // Process the data - first row is header
        const headers = data.values[0].map(header => header.toLowerCase());
        const nameIndex = headers.indexOf('name');
        const instagramIndex = headers.findIndex(h => h.includes('instagram'));
        const facebookIndex = headers.findIndex(h => h.includes('facebook'));
        
        if (nameIndex === -1 || (instagramIndex === -1 && facebookIndex === -1)) {
          sendResponse({ success: false, error: 'Sheet is missing required columns' });
          return;
        }
        
        // Parse the profiles
        const profiles = [];
        for (let i = 1; i < data.values.length; i++) {
          const row = data.values[i];
          const name = row[nameIndex];
          
          if (!name) continue;
          
          const instagramUrl = instagramIndex !== -1 && row.length > instagramIndex ? row[instagramIndex] : '';
          const facebookUrl = facebookIndex !== -1 && row.length > facebookIndex ? row[facebookIndex] : '';
          
          // Prioritize Instagram, fallback to Facebook
          if (instagramUrl) {
            profiles.push({
              name,
              platform: 'Instagram',
              url: instagramUrl,
              instagram_url: instagramUrl,
              facebook_url: facebookUrl
            });
          } else if (facebookUrl) {
            profiles.push({
              name,
              platform: 'Facebook',
              url: facebookUrl,
              instagram_url: '',
              facebook_url: facebookUrl
            });
          }
        }
        
        // Save profiles for preloading
        allProfiles = profiles;
        
        // Send response with profiles
        sendResponse({ success: true, profiles });
      } catch (error) {
        console.error('Error fetching profiles:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
  });
}

// Preload multiple profiles in advance
async function preloadProfiles(profiles, currentIndex) {
  const start = currentIndex + 1;
  const end = Math.min(start + PRELOAD_COUNT, profiles.length);
  
  for (let i = start; i < end; i++) {
    await preloadProfileTab(i);
  }
}

// Preload a single profile tab (without activating it)
async function preloadProfileTab(index) {
  if (preloadedTabs[index]) return;
  
  const profile = allProfiles[index];
  if (!profile) return;
  
  try {
    const tab = await chrome.tabs.create({
      url: profile.url,
      active: false,
      windowId: storyCheckerTab.windowId
    });
    
    preloadedTabs[index] = tab.id;
    console.log(`Preloaded profile ${index}: ${profile.name}`);
  } catch (error) {
    console.error(`Error preloading profile ${index}:`, error);
  }
}

// Open a profile in a tab
async function openProfile(url, name, platform, index, sendResponse) {
  // Update current index
  currentProfileIndex = index !== undefined ? index : currentProfileIndex;
  
  // If we have a preloaded tab for this index, use it
  if (preloadedTabs[currentProfileIndex]) {
    try {
      await chrome.tabs.update(preloadedTabs[currentProfileIndex], {
        active: true
      });
      
      // Clean up older preloaded tabs
      Object.keys(preloadedTabs).forEach(key => {
        const tabIndex = parseInt(key);
        if (tabIndex < currentProfileIndex - PRELOAD_COUNT) {
          chrome.tabs.remove(preloadedTabs[key]);
          delete preloadedTabs[key];
        }
      });
      
      sendResponse({ success: true });
      return;
    } catch (error) {
      console.error('Error activating preloaded tab:', error);
      delete preloadedTabs[currentProfileIndex];
    }
  }
  
  // If we don't have a preloaded tab, create a new one
  try {
    const tab = await chrome.tabs.create({
      url: url,
      active: true,
      windowId: storyCheckerTab.windowId
    });
    
    // Start preloading next profiles
    preloadProfiles(allProfiles, currentProfileIndex);
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error opening profile:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Reload the Story Checker tab
function reloadStoryCheckerTab(sendResponse) {
  if (storyCheckerTab) {
    chrome.tabs.reload(storyCheckerTab);
    if (sendResponse) sendResponse({ success: true });
  } else {
    chrome.storage.local.get(TAB_STORAGE_KEY, (result) => {
      const tabId = result[TAB_STORAGE_KEY];
      if (tabId) {
        chrome.tabs.reload(tabId, () => {
          if (chrome.runtime.lastError) {
            if (sendResponse) sendResponse({ success: false, error: chrome.runtime.lastError.message });
          } else {
            if (sendResponse) sendResponse({ success: true });
          }
        });
      } else {
        if (sendResponse) sendResponse({ success: false, error: 'No Story Checker tab found' });
      }
    });
  }
}

// Log choice to Google Sheets
async function logChoice(profile, choice, timestamp, sendResponse) {
  // Get a fresh token just to be sure
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (chrome.runtime.lastError || !token) {
      console.error('Token retrieval error:', chrome.runtime.lastError);
      sendResponse({ 
        success: false, 
        error: 'Authentication error: ' + (chrome.runtime.lastError?.message || 'No token available') 
      });
      return;
    }
    
    // Store the refreshed token
    chrome.storage.local.set({ authToken: token });
    
    // Get the sheet ID
    chrome.storage.local.get(['logSheetId'], async (result) => {
      if (!result.logSheetId) {
        sendResponse({ success: false, error: 'Log Sheet ID not set' });
        return;
      }
      
      try {
        // Format the timestamp for Google Sheets
        const formattedTimestamp = new Date(timestamp).toLocaleString();
        
        // Check if we need to add a date separator
        const today = new Date(timestamp).toDateString();
        if (lastCheckDate !== today) {
          await addDateSeparator(today, token, result.logSheetId);
          lastCheckDate = today;
        }
        
        // Determine what to log based on special profiles
        let rowsToLog = [];
        
        if (specialProfiles.has(profile.name)) {
          // Log just the name for special profiles
          rowsToLog.push([
            formattedTimestamp,
            profile.name,
            profile.platform,
            '', // Empty URL for special profiles
            choice
          ]);
        } else {
          // Log both Instagram and Facebook URLs if available
          if (profile.instagram_url) {
            rowsToLog.push([
              formattedTimestamp,
              profile.name,
              'Instagram',
              profile.instagram_url,
              choice
            ]);
          }
          
          if (profile.facebook_url && (profile.platform !== 'Facebook' || !profile.instagram_url)) {
            rowsToLog.push([
              formattedTimestamp,
              profile.name,
              'Facebook',
              profile.facebook_url,
              choice
            ]);
          }
        }
        
        // Log all rows to Google Sheets
        for (const rowData of rowsToLog) {
          const response = await fetch(
            `${SHEETS_API_BASE}/${result.logSheetId}/values/A:E:append?valueInputOption=USER_ENTERED`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                values: [rowData]
              })
            }
          );
          
          if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
          }
        }
        
        // After logging, switch to next profile immediately
        setTimeout(() => {
          chrome.runtime.sendMessage({
            action: 'navigateToProfile',
            index: currentProfileIndex + 1
          });
        }, PROFILE_SWITCH_DELAY);
        
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error logging choice:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
  });
}

// Add a date separator to the log sheet
async function addDateSeparator(date, token, sheetId) {
  if (!token || !sheetId) {
    // If not provided, get them
    const tokenResult = await new Promise(resolve => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        resolve(token);
      });
    });
    
    if (!tokenResult) return;
    token = tokenResult;
    
    const storageResult = await new Promise(resolve => {
      chrome.storage.local.get(['logSheetId'], (result) => {
        resolve(result.logSheetId);
      });
    });
    
    if (!storageResult) return;
    sheetId = storageResult;
  }
  
  try {
    // First, add an empty row
    await fetch(
      `${SHEETS_API_BASE}/${sheetId}/values/A:E:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [["", "", "", "", ""]]
        })
      }
    );
    
    // Then, add the date header
    await fetch(
      `${SHEETS_API_BASE}/${sheetId}/values/A:E:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [[`=== ${date} ===`, "", "", "", ""]]
        })
      }
    );
    
    console.log(`Added date separator for ${date}`);
  } catch (error) {
    console.error('Error adding date separator:', error);
  }
}
