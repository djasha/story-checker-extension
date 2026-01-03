// Content script for Google Sheets search functionality
// Runs on https://docs.google.com/spreadsheets/*

(function() {
  'use strict';

  // State
  let currentSearchTerm = '';
  let matches = [];
  let currentMatchIndex = -1;
  let highlightOverlay = null;

  // Create highlight overlay element
  function createHighlightOverlay() {
    if (highlightOverlay) return;
    
    highlightOverlay = document.createElement('div');
    highlightOverlay.id = 'story-checker-highlight';
    highlightOverlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 3px solid #10b981;
      background: rgba(16, 185, 129, 0.2);
      border-radius: 4px;
      z-index: 10000;
      display: none;
      box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
    `;
    document.body.appendChild(highlightOverlay);
  }

  // Remove highlight
  function hideHighlight() {
    if (highlightOverlay) {
      highlightOverlay.style.display = 'none';
    }
  }

  // Show highlight at position
  function showHighlightAt(rect) {
    if (!highlightOverlay) createHighlightOverlay();
    
    highlightOverlay.style.left = `${rect.left - 3}px`;
    highlightOverlay.style.top = `${rect.top - 3}px`;
    highlightOverlay.style.width = `${rect.width + 6}px`;
    highlightOverlay.style.height = `${rect.height + 6}px`;
    highlightOverlay.style.display = 'block';
  }

  // Use native Find & Replace dialog approach
  function triggerNativeFind(searchTerm) {
    // Focus the document first
    document.body.focus();
    
    // Try to use Ctrl+H (Find & Replace) which is more reliable for navigation
    const isMac = navigator.platform.includes('Mac');
    const event = new KeyboardEvent('keydown', {
      key: 'h',
      code: 'KeyH',
      ctrlKey: !isMac,
      metaKey: isMac,
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);
    
    // Wait for dialog and fill in search term
    setTimeout(() => {
      const findInput = document.querySelector('input[aria-label="Find"]') || 
                        document.querySelector('input.docs-findinput-input') ||
                        document.querySelector('[data-sheets-dialog-id] input[type="text"]');
      
      if (findInput) {
        findInput.value = searchTerm;
        findInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Trigger search
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          bubbles: true,
          cancelable: true
        });
        findInput.dispatchEvent(enterEvent);
      }
    }, 300);
  }

  // Search for text in visible cells using DOM
  function searchInDOM(searchTerm) {
    matches = [];
    currentMatchIndex = -1;
    
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return { found: false, total: 0, current: 0 };

    // Google Sheets renders cells in various ways
    // Try multiple selectors to find cell content
    const cellSelectors = [
      '[data-sheets-value]',
      '.cell-input',
      '[role="gridcell"]',
      '.softmerge-inner',
      '.s2'
    ];

    const allCells = [];
    cellSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (!allCells.includes(el)) allCells.push(el);
      });
    });

    allCells.forEach(cell => {
      let text = '';
      
      // Try to get text from data attribute first
      if (cell.hasAttribute('data-sheets-value')) {
        try {
          const value = JSON.parse(cell.getAttribute('data-sheets-value'));
          text = value[1]?.toString() || value[2]?.toString() || '';
        } catch (e) {
          text = cell.textContent || '';
        }
      } else {
        text = cell.textContent || '';
      }

      if (text.toLowerCase().includes(searchLower)) {
        matches.push({
          element: cell,
          text: text
        });
      }
    });

    if (matches.length > 0) {
      currentMatchIndex = 0;
      scrollToMatch(0);
      return { found: true, total: matches.length, current: 1 };
    }

    return { found: false, total: 0, current: 0 };
  }

  // Scroll to specific match
  function scrollToMatch(index) {
    if (index < 0 || index >= matches.length) return;
    
    const match = matches[index];
    const element = match.element;
    
    // Scroll element into view
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    });

    // Highlight the cell
    setTimeout(() => {
      const rect = element.getBoundingClientRect();
      showHighlightAt(rect);
    }, 100);
  }

  // Navigate to next match
  function nextMatch() {
    if (matches.length === 0) {
      return { found: false, total: 0, current: 0 };
    }

    currentMatchIndex = (currentMatchIndex + 1) % matches.length;
    scrollToMatch(currentMatchIndex);
    
    return {
      found: true,
      total: matches.length,
      current: currentMatchIndex + 1
    };
  }

  // Navigate to previous match
  function prevMatch() {
    if (matches.length === 0) {
      return { found: false, total: 0, current: 0 };
    }

    currentMatchIndex = currentMatchIndex <= 0 ? matches.length - 1 : currentMatchIndex - 1;
    scrollToMatch(currentMatchIndex);
    
    return {
      found: true,
      total: matches.length,
      current: currentMatchIndex + 1
    };
  }

  // Main search function
  function searchForName(name) {
    currentSearchTerm = name;
    hideHighlight();
    
    // First try DOM-based search
    const result = searchInDOM(name);
    
    if (!result.found) {
      // If DOM search fails, try native find as fallback
      triggerNativeFind(name);
      return {
        found: false,
        total: 0,
        current: 0,
        message: 'Using native search - check Find dialog'
      };
    }
    
    return result;
  }

  // Listen for messages from the extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Sheets content script received:', request);

    switch (request.action) {
      case 'searchName': {
        createHighlightOverlay();
        const searchResult = searchForName(request.name);
        sendResponse(searchResult);
        break;
      }

      case 'nextMatch': {
        const nextResult = nextMatch();
        sendResponse(nextResult);
        break;
      }

      case 'prevMatch': {
        const prevResult = prevMatch();
        sendResponse(prevResult);
        break;
      }

      case 'clearSearch': {
        hideHighlight();
        matches = [];
        currentMatchIndex = -1;
        currentSearchTerm = '';
        sendResponse({ success: true });
        break;
      }

      case 'ping': {
        sendResponse({ alive: true });
        break;
      }
    }

    return true;
  });

  // Initialize
  createHighlightOverlay();
  console.log('Story Checker: Sheets content script loaded');
})();
