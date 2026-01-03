// Content script for Google Sheets search functionality
// Runs on https://docs.google.com/spreadsheets/*

(function() {
  'use strict';

  let currentSearchTerm = '';
  let searchAttempts = 0;

  // Find the native Find input in Google Sheets
  function getFindInput() {
    return document.querySelector('input[aria-label="Find"]') || 
           document.querySelector('input.docs-findinput-input') ||
           document.querySelector('.waffle-find-and-replace-input input') ||
           document.querySelector('[data-id="find-input"]');
  }

  // Open native Find dialog using keyboard shortcut
  function openFindDialog() {
    return new Promise((resolve) => {
      // Check if dialog is already open
      let findInput = getFindInput();
      if (findInput) {
        resolve(findInput);
        return;
      }

      // Focus the spreadsheet area first
      const spreadsheet = document.querySelector('.docs-sheet-area-background') || 
                          document.querySelector('[role="grid"]') ||
                          document.body;
      spreadsheet.focus();

      // Trigger Ctrl+F / Cmd+F
      const isMac = navigator.platform.includes('Mac');
      const findEvent = new KeyboardEvent('keydown', {
        key: 'f',
        code: 'KeyF',
        keyCode: 70,
        which: 70,
        ctrlKey: !isMac,
        metaKey: isMac,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(findEvent);

      // Wait for dialog to appear
      let attempts = 0;
      const checkInterval = setInterval(() => {
        findInput = getFindInput();
        if (findInput) {
          clearInterval(checkInterval);
          resolve(findInput);
        } else if (++attempts > 20) {
          clearInterval(checkInterval);
          resolve(null);
        }
      }, 100);
    });
  }

  // Perform search using native Find
  async function searchForName(name) {
    currentSearchTerm = name;
    searchAttempts = 0;

    const findInput = await openFindDialog();
    
    if (!findInput) {
      return {
        found: false,
        total: 0,
        current: 0,
        message: 'Could not open Find dialog. Try Ctrl+F manually.'
      };
    }

    // Clear and set the search term
    findInput.focus();
    findInput.select();
    
    // Use native input methods for better compatibility
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, name);
    
    // Trigger input event
    findInput.dispatchEvent(new Event('input', { bubbles: true }));
    findInput.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for search results and press Enter to find first match
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Press Enter to trigger search
    findInput.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    }));

    // Wait for results
    await new Promise(resolve => setTimeout(resolve, 300));

    // Try to read match count from the dialog
    const matchInfo = getMatchInfo();
    
    if (matchInfo.total > 0) {
      return {
        found: true,
        total: matchInfo.total,
        current: matchInfo.current,
        message: `Found ${matchInfo.total} match(es)`
      };
    }

    return {
      found: true,
      total: 1,
      current: 1,
      message: 'Search active - use dialog navigation'
    };
  }

  // Get match count from the Find dialog
  function getMatchInfo() {
    // Look for match counter text like "1 of 5" or "No results"
    const counterSelectors = [
      '.docs-findinput-count',
      '[aria-label*="match"]',
      '.waffle-find-and-replace-count'
    ];

    for (const selector of counterSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent || '';
        const match = text.match(/(\d+)\s*of\s*(\d+)/i);
        if (match) {
          return { current: parseInt(match[1]), total: parseInt(match[2]) };
        }
        if (text.toLowerCase().includes('no result')) {
          return { current: 0, total: 0 };
        }
      }
    }

    return { current: 1, total: 1 };
  }

  // Navigate to next match using native buttons or keyboard
  async function nextMatch() {
    const findInput = getFindInput();
    if (!findInput) {
      return { found: false, total: 0, current: 0 };
    }

    // Try clicking the next button
    const nextBtn = document.querySelector('[aria-label="Find next"]') ||
                    document.querySelector('.docs-findinput-button-next') ||
                    document.querySelector('[data-tooltip="Find next"]');
    
    if (nextBtn) {
      nextBtn.click();
    } else {
      // Use Enter key as fallback
      findInput.focus();
      findInput.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        bubbles: true
      }));
    }

    await new Promise(resolve => setTimeout(resolve, 150));
    const matchInfo = getMatchInfo();

    return {
      found: true,
      total: matchInfo.total,
      current: matchInfo.current
    };
  }

  // Navigate to previous match
  async function prevMatch() {
    const findInput = getFindInput();
    if (!findInput) {
      return { found: false, total: 0, current: 0 };
    }

    // Try clicking the prev button
    const prevBtn = document.querySelector('[aria-label="Find previous"]') ||
                    document.querySelector('.docs-findinput-button-prev') ||
                    document.querySelector('[data-tooltip="Find previous"]');
    
    if (prevBtn) {
      prevBtn.click();
    } else {
      // Use Shift+Enter as fallback
      findInput.focus();
      findInput.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        shiftKey: true,
        bubbles: true
      }));
    }

    await new Promise(resolve => setTimeout(resolve, 150));
    const matchInfo = getMatchInfo();

    return {
      found: true,
      total: matchInfo.total,
      current: matchInfo.current
    };
  }

  // Close the Find dialog
  function clearSearch() {
    const closeBtn = document.querySelector('[aria-label="Close"]') ||
                     document.querySelector('.docs-findinput-close');
    if (closeBtn) {
      closeBtn.click();
    }
    currentSearchTerm = '';
    return { success: true };
  }

  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Sheets content script received:', request);

    (async () => {
      switch (request.action) {
        case 'searchName': {
          const result = await searchForName(request.name);
          sendResponse(result);
          break;
        }

        case 'nextMatch': {
          const result = await nextMatch();
          sendResponse(result);
          break;
        }

        case 'prevMatch': {
          const result = await prevMatch();
          sendResponse(result);
          break;
        }

        case 'clearSearch': {
          sendResponse(clearSearch());
          break;
        }

        case 'ping': {
          sendResponse({ alive: true });
          break;
        }
      }
    })();

    return true;
  });

  console.log('Story Checker: Sheets content script loaded');
})();
