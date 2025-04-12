/**
 * Unit tests for the Story Checker extension's side panel
 */

// Mock document and DOM elements
document.addEventListener = jest.fn();
document.getElementById = jest.fn();

// Mock Chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    openOptionsPage: jest.fn(),
    lastError: null
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    create: jest.fn()
  }
};

// Mock UI elements
const mockElements = {
  authButton: { addEventListener: jest.fn() },
  authStatus: { textContent: '', classList: { add: jest.fn(), remove: jest.fn() } },
  authSection: { style: { display: 'none' } },
  profilesSection: { style: { display: 'none' } },
  profilesList: { innerHTML: '', querySelectorAll: jest.fn().mockReturnValue([]) },
  reloadButton: { addEventListener: jest.fn() },
  settingsButton: { addEventListener: jest.fn() },
  historyButton: { addEventListener: jest.fn() },
  currentProfileName: { textContent: '' },
  currentProfileUrl: { textContent: '' },
  currentProfilePlatform: { textContent: '' },
  openProfileButton: { addEventListener: jest.fn() },
  yesBigButton: { addEventListener: jest.fn() },
  noBigButton: { addEventListener: jest.fn() },
  prevProfileButton: { addEventListener: jest.fn() },
  nextProfileButton: { addEventListener: jest.fn() },
  statusMessage: { textContent: '', className: '', style: { display: 'none' } }
};

// Mock the document.getElementById to return our mock elements
document.getElementById.mockImplementation((id) => {
  switch (id) {
    case 'auth-button': return mockElements.authButton;
    case 'auth-status': return mockElements.authStatus;
    case 'auth-section': return mockElements.authSection;
    case 'profiles-section': return mockElements.profilesSection;
    case 'profiles-list': return mockElements.profilesList;
    case 'reload-button': return mockElements.reloadButton;
    case 'settings-button': return mockElements.settingsButton;
    case 'history-button': return mockElements.historyButton;
    case 'current-profile-name': return mockElements.currentProfileName;
    case 'current-profile-url': return mockElements.currentProfileUrl;
    case 'current-profile-platform': return mockElements.currentProfilePlatform;
    case 'open-profile-button': return mockElements.openProfileButton;
    case 'yes-big-button': return mockElements.yesBigButton;
    case 'no-big-button': return mockElements.noBigButton;
    case 'prev-profile': return mockElements.prevProfileButton;
    case 'next-profile': return mockElements.nextProfileButton;
    case 'status-message': return mockElements.statusMessage;
    default: return null;
  }
});

// Create mock functions for side panel functionality
const sidepanel = {
  authenticateWithGoogle: jest.fn(),
  loadProfiles: jest.fn(),
  displayProfiles: jest.fn(),
  updateCurrentProfileDisplay: jest.fn(),
  navigateToProfile: jest.fn(),
  openProfile: jest.fn(),
  logChoice: jest.fn(),
  handleKeyPress: jest.fn(),
  openOptionsPage: jest.fn(),
  openCustomSettings: jest.fn(),
  openHistoryPage: jest.fn(),
  showStatusMessage: jest.fn()
};

describe('Side Panel Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('authenticateWithGoogle should send authenticate message to background', () => {
    // Setup mocks
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      callback({ success: true });
    });
    
    // Call the function
    sidepanel.authenticateWithGoogle();
    
    // Assertions
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'authenticate' },
      expect.any(Function)
    );
    
    expect(mockElements.authStatus.textContent).toContain('Authentication successful');
  });

  test('loadProfiles should fetch and display profiles', () => {
    // Setup mocks
    const mockProfiles = [
      {
        name: 'Test User 1',
        platform: 'Instagram',
        url: 'https://instagram.com/testuser1',
        instagram_url: 'https://instagram.com/testuser1',
        facebook_url: ''
      },
      {
        name: 'Test User 2',
        platform: 'Facebook',
        url: 'https://facebook.com/testuser2',
        instagram_url: '',
        facebook_url: 'https://facebook.com/testuser2'
      }
    ];
    
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      callback({ success: true, profiles: mockProfiles });
    });
    
    // Call the function
    sidepanel.loadProfiles();
    
    // Assertions
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'fetchProfiles' },
      expect.any(Function)
    );
    
    expect(sidepanel.displayProfiles).toHaveBeenCalledWith(mockProfiles);
    expect(sidepanel.showStatusMessage).toHaveBeenCalledWith('Profiles loaded successfully!', 'success');
  });

  test('updateCurrentProfileDisplay should update UI with current profile', () => {
    // Setup mocks
    const mockProfiles = [
      {
        name: 'Test User 1',
        platform: 'Instagram',
        url: 'https://instagram.com/testuser1'
      },
      {
        name: 'Test User 2',
        platform: 'Facebook',
        url: 'https://facebook.com/testuser2'
      }
    ];
    
    // Set mock profiles
    sidepanel.profiles = mockProfiles;
    
    // Mock profile items
    const mockItems = [
      { classList: { add: jest.fn(), remove: jest.fn() } },
      { classList: { add: jest.fn(), remove: jest.fn() } }
    ];
    
    mockElements.profilesList.querySelectorAll.mockReturnValue(mockItems);
    
    // Call the function with index 1 (second profile)
    sidepanel.updateCurrentProfileDisplay(1);
    
    // Assertions
    expect(mockElements.currentProfileName.textContent).toBe('Test User 2');
    expect(mockElements.currentProfileUrl.textContent).toBe('https://facebook.com/testuser2');
    expect(mockElements.currentProfilePlatform.textContent).toBe('Facebook');
    
    // Check that the correct item is marked as active
    expect(mockItems[0].classList.remove).toHaveBeenCalledWith('active');
    expect(mockItems[1].classList.add).toHaveBeenCalledWith('active');
  });

  test('logChoice should send log message and move to next profile', () => {
    // Setup mocks
    const mockProfiles = [
      {
        name: 'Test User 1',
        platform: 'Instagram',
        url: 'https://instagram.com/testuser1',
        instagram_url: 'https://instagram.com/testuser1',
        facebook_url: ''
      },
      {
        name: 'Test User 2',
        platform: 'Facebook',
        url: 'https://facebook.com/testuser2',
        instagram_url: '',
        facebook_url: 'https://facebook.com/testuser2'
      }
    ];
    
    // Set mock profiles
    sidepanel.profiles = mockProfiles;
    
    // Mock special profiles check
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ specialProfiles: [] });
    });
    
    // Mock sendMessage response
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      callback({ success: true });
    });
    
    // Call the function for first profile
    sidepanel.logChoice(0, 'YES');
    
    // Assertions
    expect(chrome.storage.local.get).toHaveBeenCalledWith(['specialProfiles'], expect.any(Function));
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      {
        action: 'logChoice',
        profile: mockProfiles[0],
        choice: 'YES',
        timestamp: expect.any(String)
      },
      expect.any(Function)
    );
    
    // Should move to next profile
    expect(sidepanel.openProfile).toHaveBeenCalledWith(1);
  });

  test('special profiles should be logged by name instead of URL', () => {
    // Setup mocks
    const mockProfiles = [
      {
        name: 'Special User',
        platform: 'Instagram',
        url: 'https://instagram.com/specialuser',
        instagram_url: 'https://instagram.com/specialuser',
        facebook_url: ''
      }
    ];
    
    // Set mock profiles
    sidepanel.profiles = mockProfiles;
    
    // Mock special profiles check - this time with special profile
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ specialProfiles: ['Special User'] });
    });
    
    // Mock sendMessage response
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      callback({ success: true });
    });
    
    // Call the function
    sidepanel.logChoice(0, 'YES');
    
    // Assertions
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      {
        action: 'logChoice',
        profile: expect.objectContaining({
          name: 'Special User',
          instagram_url: 'Special User', // Should use name instead of URL
          facebook_url: 'Special User',
          url: 'Special User'
        }),
        choice: 'YES',
        timestamp: expect.any(String)
      },
      expect.any(Function)
    );
  });
});
