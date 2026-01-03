# Story Checker Extension

Chrome extension for checking Instagram/Facebook stories from a Google Sheet list.

## Quick Start

1. Go to `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked" → select this folder
4. Click extension icon to open side panel

## Setup

1. Open Settings (gear icon)
2. Enter Google Sheet IDs:
   - **People Sheet**: Source list with Name, Instagram URL, Facebook URL columns
   - **Log Sheet**: Where YES results are logged

## Usage

- **Y / N keys**: Mark profile as YES/NO
- **B key**: Go back to previous
- **Arrow keys**: Navigate list
- Click profile to open in browser

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config |
| `sidepanel.html` | Main UI + CSS |
| `js/sidepanel.js` | UI logic |
| `js/background.js` | Google Sheets API |
| `options.html` | Settings page |

## Design System

Colors: Indigo (#4f46e5), Green (#10b981), Red (#ef4444)

See `HANDOFF_PHASE2.md` in parent folder for full architecture docs.
