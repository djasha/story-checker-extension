// Content script for Story Checker extension
// This script runs in the context of the Instagram and Facebook pages

// Helper to check if stories are present
function checkForStories() {
  // Instagram story detection
  if (window.location.hostname.includes('instagram.com')) {
    // Look for story rings, avatars with colorful rings indicating stories
    const storyElements = document.querySelectorAll('div[role="button"] canvas');
    const storyHeaders = document.querySelectorAll('header div[role="button"]');
    
    if (storyElements.length > 0 || storyHeaders.length > 0) {
      return true;
    }
  } 
  // Facebook story detection
  else if (window.location.hostname.includes('facebook.com')) {
    // Look for story tray or story viewer
    const storyTray = document.querySelectorAll('[data-pagelet="Stories"]');
    const storyViewerElements = document.querySelectorAll('div[aria-label*="story"]');
    
    if (storyTray.length > 0 || storyViewerElements.length > 0) {
      return true;
    }
  }
  
  return false;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkForStories') {
    const hasStories = checkForStories();
    sendResponse({ hasStories });
  }
  
  return true;
});

// Auto-detection on page load (after a delay to allow content to render)
setTimeout(() => {
  const hasStories = checkForStories();
  
  if (hasStories) {
    // Notify the extension that stories were detected
    chrome.runtime.sendMessage({
      action: 'storiesDetected',
      url: window.location.href,
      hasStories: true
    });
  }
}, 3000);  // Wait 3 seconds for content to load
