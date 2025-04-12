/**
 * Unit tests for the Story Checker extension's background script
 */

// Mock Chrome API
global.chrome = {
  identity: {
    getAuthToken: jest.fn()
  },
  runtime: {
    onMessage: {
      addListener: jest.fn()
    },
    lastError: null
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    create: jest.fn(),
    update: jest.fn(),
    get: jest.fn(),
    reload: jest.fn()
  },
  sidePanel: {
    setPanelBehavior: jest.fn().mockReturnValue({
      catch: jest.fn()
    })
  }
};

// Mock fetch
global.fetch = jest.fn();

// Import background script functionality
// Note: In a real test, you'd need to use a bundler like webpack to import the script
// For this example, we'll mock the functions directly
const background = {
  authenticateWithGoogle: jest.fn(),
  fetchProfiles: jest.fn(),
  openProfile: jest.fn(),
  logChoice: jest.fn(),
  reloadStoryCheckerTab: jest.fn(),
  addDateSeparator: jest.fn()
};

describe('Background Script Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('authenticateWithGoogle should get auth token and store it', async () => {
    // Setup mocks
    const mockToken = 'test-auth-token';
    const mockSendResponse = jest.fn();
    
    chrome.identity.getAuthToken.mockImplementation((options, callback) => {
      callback(mockToken);
    });
    
    chrome.storage.local.set.mockImplementation((data, callback) => {
      callback();
    });
    
    // Call the function
    await background.authenticateWithGoogle(mockSendResponse);
    
    // Assertions
    expect(chrome.identity.getAuthToken).toHaveBeenCalledWith(
      { interactive: true },
      expect.any(Function)
    );
    
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { authToken: mockToken },
      expect.any(Function)
    );
    
    expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('fetchProfiles should retrieve profiles from Google Sheets', async () => {
    // Setup mocks
    const mockToken = 'test-auth-token';
    const mockSheetId = 'test-sheet-id';
    const mockSendResponse = jest.fn();
    
    chrome.identity.getAuthToken.mockImplementation((options, callback) => {
      callback(mockToken);
    });
    
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ peopleSheetId: mockSheetId });
    });
    
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        values: [
          ['Name', 'Instagram URL', 'Facebook URL'],
          ['Test User', 'https://instagram.com/testuser', 'https://facebook.com/testuser']
        ]
      })
    };
    
    global.fetch.mockResolvedValue(mockResponse);
    
    // Call the function
    await background.fetchProfiles(mockSendResponse);
    
    // Assertions
    expect(chrome.identity.getAuthToken).toHaveBeenCalled();
    expect(chrome.storage.local.get).toHaveBeenCalledWith(['peopleSheetId'], expect.any(Function));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(mockSheetId),
      expect.objectContaining({
        headers: {
          'Authorization': `Bearer ${mockToken}`
        }
      })
    );
    
    expect(mockSendResponse).toHaveBeenCalledWith({
      success: true,
      profiles: expect.arrayContaining([
        expect.objectContaining({
          name: 'Test User',
          platform: 'Instagram',
          url: 'https://instagram.com/testuser'
        })
      ])
    });
  });

  test('logChoice should log choice to Google Sheets', async () => {
    // Setup mocks
    const mockToken = 'test-auth-token';
    const mockSheetId = 'log-sheet-id';
    const mockProfile = {
      name: 'Test User',
      platform: 'Instagram',
      url: 'https://instagram.com/testuser',
      instagram_url: 'https://instagram.com/testuser',
      facebook_url: 'https://facebook.com/testuser'
    };
    const mockChoice = 'YES';
    const mockTimestamp = '2025-04-12T21:30:00.000Z';
    const mockSendResponse = jest.fn();
    
    chrome.identity.getAuthToken.mockImplementation((options, callback) => {
      callback(mockToken);
    });
    
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ logSheetId: mockSheetId });
    });
    
    const mockResponse = {
      ok: true
    };
    
    global.fetch.mockResolvedValue(mockResponse);
    
    // Call the function
    await background.logChoice(mockProfile, mockChoice, mockTimestamp, mockSendResponse);
    
    // Assertions
    expect(chrome.identity.getAuthToken).toHaveBeenCalled();
    expect(chrome.storage.local.get).toHaveBeenCalledWith(['logSheetId'], expect.any(Function));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(mockSheetId),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mockToken}`,
          'Content-Type': 'application/json'
        },
        body: expect.any(String)
      })
    );
    
    expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('addDateSeparator should add a date separator to the log sheet', async () => {
    // Setup mocks
    const mockToken = 'test-auth-token';
    const mockSheetId = 'log-sheet-id';
    const mockDate = 'Mon Apr 12 2025';
    
    chrome.identity.getAuthToken.mockImplementation((options, callback) => {
      callback(mockToken);
    });
    
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ logSheetId: mockSheetId });
    });
    
    const mockResponse = {
      ok: true
    };
    
    global.fetch.mockResolvedValue(mockResponse);
    
    // Call the function
    await background.addDateSeparator(mockDate, mockToken, mockSheetId);
    
    // Assertions
    expect(global.fetch).toHaveBeenCalledTimes(2); // Empty row + date header
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(mockSheetId),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining(mockDate)
      })
    );
  });
});
