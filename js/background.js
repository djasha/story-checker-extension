// Background script for Story Checker extension
// Handles Google Sheets API integration and tab management

// Constants
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const TAB_STORAGE_KEY = 'story_checker_tab';
const PEOPLE_SHEET_ID = '';
const LOG_SHEET_ID = '';

// State
let storyCheckerTab = null;

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log('Story Checker extension installed');
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
      openProfile(request.url, request.name, request.platform, sendResponse);
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

    case 'searchInSheets':
      searchInSheetsTab(request.name, sendResponse);
      return true;

    case 'sheetsNextMatch':
      sendToSheetsTab('nextMatch', sendResponse);
      return true;

    case 'sheetsPrevMatch':
      sendToSheetsTab('prevMatch', sendResponse);
      return true;

    case 'clearSheetSearch':
      sendToSheetsTab('clearSearch', sendResponse);
      return true;
  }
});

// Authenticate with Google using simpler chrome.identity.getAuthToken API
function authenticateWithGoogle(sendResponse) {
  console.log('Starting authentication using chrome.identity.getAuthToken...');

  chrome.identity.getAuthToken({ interactive: true }, async (token) => {
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

    // Get user info to store settings per account
    try {
      const userInfo = await fetchUserInfo(token);
      const userEmail = userInfo.email;
      console.log('Logged in as:', userEmail);

      // Check if we have saved settings for this user
      const userSettingsKey = `userSettings_${userEmail}`;
      chrome.storage.local.get([userSettingsKey], (result) => {
        const savedSettings = result[userSettingsKey];
        
        const dataToStore = { 
          authToken: token,
          currentUserEmail: userEmail
        };

        // Restore user's sheet IDs if they exist
        if (savedSettings) {
          console.log('Restoring settings for user:', userEmail);
          if (savedSettings.peopleSheetId) dataToStore.peopleSheetId = savedSettings.peopleSheetId;
          if (savedSettings.logSheetId) dataToStore.logSheetId = savedSettings.logSheetId;
          if (savedSettings.specialProfiles) dataToStore.specialProfiles = savedSettings.specialProfiles;
        }

        chrome.storage.local.set(dataToStore, () => {
          console.log('Access token and user settings stored successfully');
          sendResponse({ success: true, email: userEmail, settingsRestored: !!savedSettings });
        });
      });
    } catch (error) {
      console.error('Error fetching user info:', error);
      // Still store token even if user info fetch fails
      chrome.storage.local.set({ authToken: token }, () => {
        sendResponse({ success: true });
      });
    }
  });
}

// Fetch user info from Google
async function fetchUserInfo(token) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }
  return response.json();
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

        sendResponse({ success: true, profiles });
      } catch (error) {
        console.error('Error fetching profiles:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
  });
}

// Open a profile in a tab
async function openProfile(url, name, platform, sendResponse) {
  try {
    // First check if we already have a tab open
    let existingTab = null;

    // Try to find the existing tab from storage
    const storedTabId = await new Promise(resolve => {
      chrome.storage.local.get(TAB_STORAGE_KEY, (result) => {
        resolve(result[TAB_STORAGE_KEY]);
      });
    });

    if (storedTabId) {
      try {
        existingTab = await new Promise(resolve => {
          chrome.tabs.get(storedTabId, tab => {
            if (chrome.runtime.lastError) {
              resolve(null);
            } else {
              resolve(tab);
            }
          });
        });
      } catch (e) {
        existingTab = null;
      }
    }

    if (existingTab) {
      // Update the existing tab
      chrome.tabs.update(existingTab.id, {
        active: true,
        url: url
      });
      storyCheckerTab = existingTab.id;
    } else {
      // Create a new tab
      chrome.tabs.create({ url: url }, (tab) => {
        storyCheckerTab = tab.id;
        chrome.storage.local.set({ [TAB_STORAGE_KEY]: tab.id });
      });
    }

    if (sendResponse) sendResponse({ success: true });
  } catch (error) {
    console.error('Error opening profile:', error);
    if (sendResponse) sendResponse({ success: false, error: error.message });
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
function logChoice(profile, choice, timestamp, sendResponse) {
  // If choice is NO, don't log to the sheet, just return success
  if (choice === 'NO') {
    console.log('NO choice selected, not logging to sheet');
    sendResponse({ success: true });
    return;
  }

  // Get a fresh token - only for YES choices
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

    // Get the sheet ID and special profiles
    chrome.storage.local.get(['logSheetId', 'specialProfiles'], async (result) => {
      if (!result.logSheetId) {
        sendResponse({ success: false, error: 'Log Sheet ID not set' });
        return;
      }

      try {
        // Format the timestamp as Day/Month only (e.g., 14/4)
        const date = new Date(timestamp);
        const formattedTimestamp = `${date.getDate()}/${date.getMonth() + 1}`;

        // Check if we need to add a date separator
        const today = new Date(timestamp).toDateString();
        if (lastCheckDate !== today) {
          await addDateSeparator(today, token, result.logSheetId);
          lastCheckDate = today;
        }

        // Check if this profile is in the special profiles list
        const specialProfiles = result.specialProfiles || [];
        const isSpecialProfile = specialProfiles.includes(profile.name);

        // Log both Instagram and Facebook URLs if available (YES only)
        let rowsToLog = [];

        if (profile.instagram_url) {
          rowsToLog.push([
            formattedTimestamp,   // Column A: Date
            profile.name,         // Column B: Name
            'Instagram',          // Column C: Platform
            isSpecialProfile ? profile.name : profile.instagram_url, // Column D: URL or name for special profiles
            choice                // Column E: Story Posted
          ]);
        }

        if (profile.facebook_url && (profile.platform !== 'Facebook' || !profile.instagram_url)) {
          rowsToLog.push([
            formattedTimestamp,   // Column A: Date
            profile.name,         // Column B: Name
            'Facebook',           // Column C: Platform
            isSpecialProfile ? profile.name : profile.facebook_url, // Column D: URL or name for special profiles
            choice                // Column E: Story Posted
          ]);
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

        sendResponse({ success: true });
      } catch (error) {
        console.error('Error logging choice:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
  });
}

// Search for name in the currently open Google Sheet and navigate to the cell
async function searchInSheetsTab(name, sendResponse) {
  try {
    // Find the currently open Google Sheets tab
    const tabs = await chrome.tabs.query({ url: 'https://docs.google.com/spreadsheets/*' });
    
    if (tabs.length === 0) {
      sendResponse({ found: false, message: 'No Google Sheet open. Please open a sheet first.' });
      return;
    }
    
    const sheetsTab = tabs[0];
    const tabUrl = sheetsTab.url;
    
    // Extract sheet ID from URL
    const sheetIdMatch = tabUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!sheetIdMatch) {
      sendResponse({ found: false, message: 'Could not get sheet ID from URL' });
      return;
    }
    const sheetId = sheetIdMatch[1];
    
    // Extract gid (sheet tab) from URL if present
    const gidMatch = tabUrl.match(/gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : '0';
    
    // Get auth token
    const token = await new Promise(resolve => {
      chrome.identity.getAuthToken({ interactive: false }, resolve);
    });
    
    if (!token) {
      sendResponse({ found: false, message: 'Not authenticated. Please reconnect.' });
      return;
    }
    
    // First get sheet metadata to find the sheet name for the current gid
    const metaResponse = await fetch(
      `${SHEETS_API_BASE}/${sheetId}?fields=sheets(properties(sheetId,title))`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    if (!metaResponse.ok) {
      sendResponse({ found: false, message: 'Failed to access sheet' });
      return;
    }
    
    const metaData = await metaResponse.json();
    const sheets = metaData.sheets || [];
    const currentSheet = sheets.find(s => s.properties.sheetId.toString() === gid);
    const sheetName = currentSheet ? currentSheet.properties.title : 'Sheet1';
    
    // Fetch sheet data to search (use the current sheet tab)
    const response = await fetch(
      `${SHEETS_API_BASE}/${sheetId}/values/'${encodeURIComponent(sheetName)}'!A:Z?majorDimension=ROWS`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    if (!response.ok) {
      sendResponse({ found: false, message: 'Failed to fetch sheet data' });
      return;
    }
    
    const data = await response.json();
    const rows = data.values || [];
    
    // Search for the name (case-insensitive partial match)
    const searchLower = name.toLowerCase().trim();
    let foundRow = -1;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      for (let j = 0; j < row.length; j++) {
        if (row[j] && row[j].toString().toLowerCase().includes(searchLower)) {
          foundRow = i + 1; // Sheets are 1-indexed
          break;
        }
      }
      if (foundRow > 0) break;
    }
    
    if (foundRow === -1) {
      sendResponse({ found: false, message: `"${name}" not found` });
      return;
    }
    
    // Navigate to the cell in the same sheet tab
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${gid}&range=A${foundRow}`;
    
    // Update existing tab to navigate to the cell
    await chrome.tabs.update(sheetsTab.id, { url: sheetUrl, active: true });
    await chrome.windows.update(sheetsTab.windowId, { focused: true });
    
    sendResponse({ 
      found: true, 
      row: foundRow,
      message: `Found at row ${foundRow}`
    });
    
  } catch (error) {
    console.error('Error searching in sheets:', error);
    sendResponse({ found: false, message: error.message });
  }
}

// Send action to sheets content script
async function sendToSheetsTab(action, sendResponse) {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://docs.google.com/spreadsheets/*' });
    
    if (tabs.length === 0) {
      if (sendResponse) sendResponse({ found: false });
      return;
    }

    const sheetsTab = tabs[0];
    
    try {
      const response = await chrome.tabs.sendMessage(sheetsTab.id, { action: action });
      if (sendResponse) sendResponse(response);
    } catch (err) {
      if (sendResponse) sendResponse({ found: false });
    }
  } catch (error) {
    console.error('Error sending to sheets tab:', error);
    if (sendResponse) sendResponse({ found: false });
  }
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
