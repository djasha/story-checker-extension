# Story Checker Extension

A Chrome extension that helps marketing agencies efficiently check Instagram and Facebook stories from a Google Sheet list.

## Features

- **Side Panel Interface**: Modern, intuitive UI that opens alongside your browser
- **Google Sheets Integration**: Load profiles from and log results to Google Sheets
- **Keyboard Shortcuts**: Quick Y/N marking with keyboard navigation
- **Search Mode**: Find profiles in your Google Sheet for manual date entry
- **Progress Tracking**: Visual progress bar and statistics
- **Session Persistence**: Resume where you left off

## Installation

### From Chrome Web Store
1. Visit the Chrome Web Store (link coming soon)
2. Click "Add to Chrome"

### For Development
1. Go to `chrome://extensions`
2. Enable "Developer Mode"
3. Click "Load unpacked" → select this folder
4. Click the extension icon to open the side panel

## Setup

1. Click the extension icon and authenticate with Google
2. Open Settings (gear icon)
3. Enter your Google Sheet IDs:
   - **People Sheet**: Source list with columns: Name, Instagram URL, Facebook URL
   - **Log Sheet**: Where YES results are logged

## Usage

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Y` | Mark as YES |
| `N` | Mark as NO |
| `B` | Go back to previous |
| `↑/↓` or `J/K` | Navigate list |
| `R` | Reload profiles |

### Search Mode
1. Click the magnifying glass icon to enter Search Mode
2. Only YES profiles are shown
3. Click a profile to search for it in your open Google Sheet
4. Use Prev/Next buttons to navigate matches

## Privacy

This extension:
- Only accesses Instagram, Facebook, and Google Sheets URLs you explicitly configure
- Stores data locally in your browser
- Uses Google OAuth for secure authentication
- Does not collect or transmit personal data

## Permissions

| Permission | Purpose |
|------------|---------|
| `tabs` | Open and manage profile tabs |
| `storage` | Save settings and session state |
| `identity` | Google OAuth authentication |
| `scripting` | Search functionality in Google Sheets |

## Support

For issues or feature requests, visit: https://github.com/djasha/story-checker-extension
