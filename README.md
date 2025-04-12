# Story Checker Chrome Extension

This Chrome extension is designed to streamline the process of checking Instagram and Facebook stories for marketing agencies. It offers a more reliable alternative to the desktop application by using Chrome's native browser engine.

## Features

- Direct integration with Google Sheets to load profiles and log results
- Color-coded history tracking of checked profiles
- Keyboard shortcuts for faster workflow
- Easy navigation between profiles
- Persistent session handling for Instagram and Facebook
- Clean, intuitive user interface

## Setup Instructions

### 1. Install the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" using the toggle in the upper right
3. Click "Load unpacked" and select the `chrome-extension` folder
4. The Story Checker extension should now appear in your extensions list

### 2. Configure Google Sheets

1. Create two Google Sheets:
   - **People List**: Contains columns for Name, Instagram URL, and Facebook URL
   - **Story Checks Log**: Where results will be logged (can be empty initially)

2. Get the Sheet IDs from the URLs:
   - The ID is the long string in the URL between `/d/` and `/edit`
   - Example: `https://docs.google.com/spreadsheets/d/`**`1a2b3c4d5e6f7g8h9i0j`**`/edit`

3. Open the extension options by:
   - Right-clicking the extension icon and selecting "Options", or
   - Clicking the ⚙️ Settings button in the extension popup

4. Enter your Sheet IDs in the appropriate fields and save

### 3. Google OAuth Setup

For the Google Sheets integration to work, you need to:

1. Create a new project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the Google Sheets API
3. Create OAuth credentials
4. Add the client ID to the manifest.json file (replace `${CLIENT_ID}` with your actual client ID)

## Usage

1. Click the Story Checker icon in your Chrome toolbar
2. Connect to Google Sheets when prompted
3. The extension will load profiles from your People List sheet
4. For each profile:
   - View the profile in the Chrome tab that opens
   - Check if they have posted stories
   - Click YES or NO in the extension popup (or press Y/N keys)
   - Results are logged automatically

## Keyboard Shortcuts

- `Y`: Mark as YES
- `N`: Mark as NO
- `S`: Skip to next profile
- `R`: Reload current page

## Troubleshooting

If you encounter issues:
- Check that your Google Sheets have the correct format
- Ensure you've granted the necessary permissions
- Try refreshing the extension by clicking the reload button in `chrome://extensions/`
- Check the browser console for error messages

## Development Notes

This extension uses:
- Chrome's identity API for Google OAuth
- Google Sheets API v4 for data access
- Standard web technologies (HTML, CSS, JavaScript)
