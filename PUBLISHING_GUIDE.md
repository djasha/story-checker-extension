# Chrome Web Store Publishing Guide

This guide helps you prepare the final assets and information needed to publish **Story Checker** to the Chrome Web Store.

## 1. Store Metadata
- **Name**: Story Checker
- **Summary**: Efficiently audit Instagram & Facebook stories from Google Sheets.
- **Description**: (Use the content from the "Features" section in README.md)
- **Category**: Productivity
- **Language**: English (United States)

## 2. Media Assets Checklist

### Required Icons
The following are already generated in `/images/`:
- [x] **128x128**: Main store icon.
- [x] **48x48**: Settings icon.
- [x] **16x16**: Toolbar favicon.

### Promotional Tiles (Required)
You need to create these (Templates in `/store-assets/`):
- [ ] **Small Tile (440x280)**: *The most important.* Should be clean with the logo and name.
- [ ] **Large Tile (920x680)**: Used in collections.
- [ ] **Marquee (1400x560)**: Used for featuring.

### Screenshots (Required)
Capture at least 4 screenshots (1280x800 or 640x400):
1. **The Sidebar**: Side panel open next to a social media profile.
2. **Search Mode**: The search bar active with matches highlighted in a sheet.
3. **Settings**: The clean setup screen with Sheet IDs.
4. **Completion**: The "All Done!" celebration screen.

## 3. Privacy & Compliance
- **Single Purpose**: This extension has one purpose: auditing social media stories via Google Sheets.
- **Permissions Justification**:
    - `storage`: Saving user settings and session state.
    - `identity`: Securely connecting to Google Sheets via OAuth.
    - `scripting`: Required for the Search Mode DOM-based search in Google Sheets.
    - `tabs`: Managing the social media profiles being audited.
- **Privacy Policy**: Use the text provided in README.md to create a simple hosted page (e.g., GitHub Pages).

## 4. Final Package
1. Open the project folder.
2. Select all files **except** `.git`, `.gitignore`, and `DESIGN_ASSETS.md`.
3. Compress into a ZIP file.
4. Upload to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).
