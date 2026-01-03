// Side Panel script for Story Checker - Phase 2 with UX improvements
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const authButton = document.getElementById('auth-button');
  const authStatus = document.getElementById('auth-status');
  const authSection = document.getElementById('auth-section');
  const profilesSection = document.getElementById('profiles-section');
  const profilesList = document.getElementById('profiles-list');
  const reloadButton = document.getElementById('reload-button');
  const settingsButton = document.getElementById('settings-button');
  const historyButton = document.getElementById('history-button');
  const profilesSheetButton = document.getElementById('profiles-sheet-button');
  const statusMessage = document.getElementById('status-message');
  const loadMoreContainer = document.getElementById('load-more-container');
  const loadMoreButton = document.getElementById('load-more-button');
  const loadingOverlay = document.getElementById('loading-overlay');
  const backButton = document.getElementById('back-button');

  // Search mode elements
  const searchModeButton = document.getElementById('search-mode-button');
  const searchNavBar = document.getElementById('search-nav-bar');
  const searchNavClose = document.getElementById('search-nav-close');
  const searchCurrentName = document.getElementById('search-current-name');
  const searchMatchCounter = document.getElementById('search-match-counter');
  const searchPrevBtn = document.getElementById('search-prev-btn');
  const searchNextBtn = document.getElementById('search-next-btn');
  const profilesContainer = document.querySelector('.profiles-container');

  // Stats (clickable for filtering)
  const statYes = document.getElementById('stat-yes');
  const statNo = document.getElementById('stat-no');
  const statPending = document.getElementById('stat-pending');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const yesCount = document.getElementById('yes-count');
  const noCount = document.getElementById('no-count');
  const pendingCount = document.getElementById('pending-count');

  // Completion
  const completionSection = document.getElementById('completion-section');
  const completionYes = document.getElementById('completion-yes');
  const completionNo = document.getElementById('completion-no');
  const copyLinksButton = document.getElementById('copy-links-button');
  const clearButton = document.getElementById('clear-button');

  // Main actions
  const currentProfileElement = document.getElementById('current-profile');
  const currentUrlElement = document.getElementById('current-url');
  const yesButton = document.getElementById('yes-button');
  const noButton = document.getElementById('no-button');

  // State
  let allProfiles = [];
  let profiles = [];
  let currentProfileIndex = -1;
  let currentPage = 0;
  let pageSize = 20;
  let preloadedUrls = new Set();
  let navigationHistory = [];
  let profileChoices = {};
  let skippedProfiles = new Set();
  let specialProfiles = [];
  let currentFilter = null; // 'yes', 'no', 'pending', or null (all)
  let isSearchMode = false;
  let currentSearchName = '';
  let searchMatchTotal = 0;
  let searchMatchCurrent = 0;

  // Save state on close
  window.addEventListener('beforeunload', saveState);

  function saveState() {
    chrome.storage.local.set({
      sidebarState: {
        profiles, currentProfileIndex, currentPage,
        preloadedUrls: Array.from(preloadedUrls),
        navigationHistory,
        skippedProfiles: Array.from(skippedProfiles)
      },
      profileChoices
    });
  }

  // Init
  checkAuthStatus();
  loadSpecialProfiles();

  // Event listeners
  authButton.addEventListener('click', authenticateWithGoogle);
  reloadButton.addEventListener('click', loadAllProfiles);
  settingsButton.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('options.html') }));
  historyButton.addEventListener('click', openHistorySheet);
  profilesSheetButton.addEventListener('click', openProfilesSheet);
  yesButton.addEventListener('click', () => currentProfileIndex >= 0 && logChoice(currentProfileIndex, 'YES'));
  noButton.addEventListener('click', () => currentProfileIndex >= 0 && logChoice(currentProfileIndex, 'NO'));
  loadMoreButton.addEventListener('click', loadMoreProfiles);
  backButton.addEventListener('click', goBack);
  copyLinksButton.addEventListener('click', copyYesLinks);
  clearButton.addEventListener('click', clearAndStartOver);

  // Clickable stats for filtering
  statYes.addEventListener('click', () => toggleFilter('yes'));
  statNo.addEventListener('click', () => toggleFilter('no'));
  statPending.addEventListener('click', () => toggleFilter('pending'));

  // Search mode event listeners
  searchModeButton.addEventListener('click', toggleSearchMode);
  searchNavClose.addEventListener('click', exitSearchMode);
  searchPrevBtn.addEventListener('click', searchPrevMatch);
  searchNextBtn.addEventListener('click', searchNextMatch);
  searchCurrentName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const name = searchCurrentName.value.trim();
      if (name) {
        searchInSheets(name);
      }
    }
  });

  document.addEventListener('keydown', handleKeyPress);
  document.addEventListener('click', closeAllDropdowns);

  // Functions
  function showLoading() { loadingOverlay.classList.add('active'); }
  function hideLoading() { loadingOverlay.classList.remove('active'); }

  function loadSpecialProfiles() {
    chrome.storage.local.get(['specialProfiles'], r => {
      specialProfiles = r.specialProfiles || [];
    });
  }

  function toggleFilter(type) {
    // Toggle off if clicking same filter
    if (currentFilter === type) {
      currentFilter = null;
      statYes.classList.remove('active');
      statNo.classList.remove('active');
      statPending.classList.remove('active');
      applyFilter();
      showStatusMessage('Showing all', 'info');
      return;
    }

    currentFilter = type;
    statYes.classList.toggle('active', type === 'yes');
    statNo.classList.toggle('active', type === 'no');
    statPending.classList.toggle('active', type === 'pending');
    applyFilter();

    const label = type === 'yes' ? 'YES' : type === 'no' ? 'NO' : 'Pending';
    showStatusMessage(`Showing ${label} only`, 'info');
  }

  function applyFilter() {
    loadMoreContainer.style.display = 'none';

    if (!currentFilter) {
      // Show all
      profiles = allProfiles.slice(0, pageSize * (currentPage + 1));
      if (profiles.length < allProfiles.length) loadMoreContainer.style.display = 'block';
    } else if (currentFilter === 'yes') {
      profiles = allProfiles.filter(p => profileChoices[p.url] === 'YES');
    } else if (currentFilter === 'no') {
      profiles = allProfiles.filter(p => profileChoices[p.url] === 'NO');
    } else if (currentFilter === 'pending') {
      profiles = allProfiles.filter(p => !profileChoices[p.url] && !skippedProfiles.has(p.url));
    }

    displayProfiles(profiles);
  }

  function updateStats() {
    const total = allProfiles.length - skippedProfiles.size;
    let yesTotal = 0, noTotal = 0;

    Object.entries(profileChoices).forEach(([url, choice]) => {
      if (!skippedProfiles.has(url)) {
        if (choice === 'YES') yesTotal++;
        else if (choice === 'NO') noTotal++;
      }
    });

    const checked = yesTotal + noTotal;
    const pending = total - checked;
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

    progressBar.style.width = `${pct}%`;
    progressText.textContent = `#${Math.max(0, currentProfileIndex + 1)} of ${allProfiles.length}`;
    yesCount.textContent = yesTotal;
    noCount.textContent = noTotal;
    pendingCount.textContent = pending;

    if (total > 0 && pending === 0) showCompletionScreen(yesTotal, noTotal);
  }

  function showCompletionScreen(y, n) {
    profilesSection.style.display = 'none';
    completionSection.classList.add('active');
    completionYes.textContent = y;
    completionNo.textContent = n;
  }

  function hideCompletionScreen() {
    completionSection.classList.remove('active');
    profilesSection.style.display = 'block';
  }

  function copyYesLinks() {
    const links = allProfiles.filter(p => profileChoices[p.url] === 'YES').map(p => p.url);
    if (!links.length) return showStatusMessage('No YES links', 'info');
    navigator.clipboard.writeText(links.join('\n')).then(() => {
      showStatusMessage(`Copied ${links.length} links`, 'success');
      copyLinksButton.textContent = 'Copied!';
      setTimeout(() => copyLinksButton.textContent = 'Copy YES Links', 2000);
    }).catch(() => showStatusMessage('Failed to copy', 'error'));
  }

  function clearAndStartOver() {
    profileChoices = {};
    navigationHistory = [];
    skippedProfiles.clear();
    preloadedUrls.clear();
    currentProfileIndex = -1;
    currentFilter = null;
    statYes.classList.remove('active');
    statNo.classList.remove('active');
    statPending.classList.remove('active');
    chrome.storage.local.remove(['profileChoices', 'sidebarState']);
    hideCompletionScreen();
    loadAllProfiles();
    showStatusMessage('Cleared! Starting fresh', 'success');
  }

  function goBack() {
    if (!navigationHistory.length) return showStatusMessage('No history', 'info');
    const prev = navigationHistory.pop();
    updateBackButtonState();
    selectProfileWithoutHistory(prev);
    openProfileDirect(profiles[prev]);
    scrollToActiveProfile();
    showStatusMessage('Went back', 'info');
  }

  function updateBackButtonState() {
    backButton.disabled = navigationHistory.length === 0;
  }

  function checkAuthStatus() {
    chrome.storage.local.get(['authToken', 'profileChoices', 'sidebarState'], result => {
      if (result.authToken) {
        authStatus.textContent = 'Connected';
        authStatus.classList.add('success');
        authSection.style.display = 'none';
        profilesSection.style.display = 'block';
        if (result.profileChoices) profileChoices = result.profileChoices;
        if (result.sidebarState) restoreState(result.sidebarState);
        else loadAllProfilesWithoutReset();
      }
    });
  }

  function restoreState(state) {
    if (state.profiles?.length) {
      profiles = state.profiles;
      if (state.skippedProfiles) skippedProfiles = new Set(state.skippedProfiles);
      if (state.preloadedUrls) preloadedUrls = new Set(state.preloadedUrls);
      if (state.navigationHistory) navigationHistory = state.navigationHistory;
      displayProfiles(profiles);
      if (state.currentProfileIndex >= 0 && state.currentProfileIndex < profiles.length) {
        selectProfileWithoutHistory(state.currentProfileIndex);
        setTimeout(scrollToActiveProfile, 100);
      }
      currentPage = state.currentPage || 0;
      updateBackButtonState();
      loadAllProfilesInBackground();
      showStatusMessage('Session restored', 'success');
    } else loadAllProfiles();
  }

  function authenticateWithGoogle() {
    authButton.disabled = true;
    authStatus.textContent = 'Connecting...';
    showLoading();
    chrome.runtime.sendMessage({ action: 'authenticate' }, response => {
      authButton.disabled = false;
      hideLoading();
      if (response?.success) {
        authStatus.textContent = 'Connected!';
        authStatus.classList.add('success');
        authSection.style.display = 'none';
        profilesSection.style.display = 'block';
        loadAllProfiles();
      } else {
        authStatus.textContent = `Error: ${response?.error || 'Unknown'}`;
      }
    });
  }

  function loadAllProfiles() {
    showStatusMessage('Loading...', 'info');
    profilesList.innerHTML = '<p style="text-align:center;color:#64748b;padding:16px;">Loading...</p>';
    loadMoreContainer.style.display = 'none';
    showLoading();
    profileChoices = {};
    skippedProfiles.clear();
    currentFilter = null;
    statYes.classList.remove('active');
    statNo.classList.remove('active');
    statPending.classList.remove('active');
    chrome.storage.local.remove(['profileChoices']);
    navigationHistory = [];
    updateBackButtonState();

    chrome.runtime.sendMessage({ action: 'fetchProfiles' }, response => {
      hideLoading();
      if (response?.success) {
        allProfiles = response.profiles;
        currentPage = 0;
        preloadedUrls.clear();
        profiles = allProfiles.slice(0, pageSize);
        displayProfiles(profiles);
        if (allProfiles.length > pageSize) loadMoreContainer.style.display = 'block';
        showStatusMessage(`Loaded ${allProfiles.length} profiles`, 'success');
        updateStats();
        queueRollingPreload();
      } else {
        profilesList.innerHTML = `<p style="color:#ef4444;text-align:center;">Error: ${response?.error}</p>`;
      }
    });
  }

  function loadAllProfilesInBackground() {
    chrome.runtime.sendMessage({ action: 'fetchProfiles' }, r => {
      if (r?.success) { allProfiles = r.profiles; updateStats(); }
    });
  }

  function loadMoreProfiles() {
    return new Promise(resolve => {
      currentPage++;
      const start = currentPage * pageSize;
      profiles = [...profiles, ...allProfiles.slice(start, start + pageSize)];
      displayProfiles(profiles);
      if (start + pageSize >= allProfiles.length) loadMoreContainer.style.display = 'none';
      showStatusMessage(`Loaded ${profiles.length}/${allProfiles.length}`, 'info');
      resolve();
    });
  }

  function loadAllProfilesWithoutReset() {
    showLoading();
    chrome.runtime.sendMessage({ action: 'fetchProfiles' }, r => {
      hideLoading();
      if (r?.success) {
        allProfiles = r.profiles;
        currentPage = 0;
        profiles = allProfiles.slice(0, pageSize);
        displayProfiles(profiles);
        if (allProfiles.length > pageSize) loadMoreContainer.style.display = 'block';
        showStatusMessage(`Loaded ${allProfiles.length} profiles`, 'success');
        updateStats();
        queueRollingPreload();
      }
    });
  }

  function displayProfiles(list) {
    if (!list?.length) {
      const msg = currentFilter ? `No ${currentFilter.toUpperCase()} profiles` : 'No profiles';
      profilesList.innerHTML = `<p style="text-align:center;color:#64748b;padding:16px;">${msg}</p>`;
      return;
    }

    profilesList.innerHTML = '';

    list.forEach((profile, idx) => {
      const item = document.createElement('div');
      item.className = 'profile-item';
      item.dataset.index = idx;
      item.dataset.url = profile.url;

      if (skippedProfiles.has(profile.url)) item.classList.add('skipped');
      if (profileChoices[profile.url]) item.classList.add(profileChoices[profile.url].toLowerCase());

      const isSpecial = specialProfiles.includes(profile.name);
      const isPreloaded = preloadedUrls.has(profile.url);
      const globalIdx = allProfiles.findIndex(p => p.url === profile.url) + 1;

      item.innerHTML = `
        <div class="profile-number">${globalIdx}</div>
        <div class="profile-info">
          <div class="profile-name">
            ${profile.name}
            ${isSpecial ? '<span class="special-badge" title="Special">S</span>' : ''}
          </div>
          <div class="profile-url">${profile.platform}: ${shortenUrl(profile.url)}</div>
        </div>
        <div class="profile-indicators">
          ${isPreloaded ? '<div class="preload-dot" title="Preloaded"></div>' : ''}
        </div>
        <button class="menu-btn" data-menu="${idx}">&vellip;</button>
        <div class="dropdown-menu" data-dropdown="${idx}">
          <div class="dropdown-item" data-action="skip"><span class="icon">&#9744;</span>${skippedProfiles.has(profile.url) ? 'Unskip' : 'Skip'}</div>
          <div class="dropdown-item" data-action="special"><span class="icon">&starf;</span>${isSpecial ? 'Unmark' : 'Special'}</div>
          <div class="dropdown-item" data-action="undo"><span class="icon">&circlearrowleft;</span>Undo</div>
          <div class="dropdown-item danger" data-action="remove"><span class="icon">&times;</span>Remove</div>
        </div>
      `;

      item.querySelector('.profile-info').addEventListener('click', () => selectProfile(idx));
      item.querySelector('.menu-btn').addEventListener('click', e => { e.stopPropagation(); toggleDropdown(idx); });
      item.querySelectorAll('.dropdown-item').forEach(mi => {
        mi.addEventListener('click', e => { e.stopPropagation(); handleMenuAction(mi.dataset.action, profile, idx); closeAllDropdowns(); });
      });

      profilesList.appendChild(item);
    });

    if (list.length > 0 && currentProfileIndex < 0) selectProfileWithoutHistory(0);
    else if (currentProfileIndex >= 0 && currentProfileIndex < list.length) selectProfileWithoutHistory(currentProfileIndex);
    updateStats();
  }

  function handleMenuAction(action, profile, idx) {
    switch (action) {
      case 'skip':
        if (skippedProfiles.has(profile.url)) { skippedProfiles.delete(profile.url); showStatusMessage('Unskipped', 'info'); }
        else { skippedProfiles.add(profile.url); showStatusMessage('Skipped', 'info'); }
        displayProfiles(profiles);
        break;
      case 'remove':
        profiles = profiles.filter(p => p.url !== profile.url);
        allProfiles = allProfiles.filter(p => p.url !== profile.url);
        delete profileChoices[profile.url];
        skippedProfiles.delete(profile.url);
        if (currentProfileIndex >= profiles.length) currentProfileIndex = profiles.length - 1;
        displayProfiles(profiles);
        showStatusMessage('Removed', 'success');
        break;
      case 'special':
        chrome.storage.local.get(['specialProfiles'], r => {
          let sp = r.specialProfiles || [];
          if (sp.includes(profile.name)) { sp = sp.filter(n => n !== profile.name); showStatusMessage('Unmarked', 'info'); }
          else { sp.push(profile.name); showStatusMessage('Marked special', 'success'); }
          chrome.storage.local.set({ specialProfiles: sp });
          specialProfiles = sp;
          displayProfiles(profiles);
        });
        break;
      case 'undo':
        if (profileChoices[profile.url]) {
          delete profileChoices[profile.url];
          chrome.storage.local.set({ profileChoices });
          displayProfiles(profiles);
          showStatusMessage('Undone', 'info');
        } else showStatusMessage('Nothing to undo', 'info');
        break;
    }
  }

  function toggleDropdown(idx) {
    document.querySelectorAll('.dropdown-menu').forEach((m, i) => {
      if (i === idx) m.classList.toggle('open');
      else m.classList.remove('open');
    });
  }

  function closeAllDropdowns(e) {
    if (e && e.target.closest('.menu-btn')) return;
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
  }

  function selectProfile(idx) {
    if (currentProfileIndex >= 0 && currentProfileIndex !== idx) {
      navigationHistory.push(currentProfileIndex);
      updateBackButtonState();
    }
    selectProfileCore(idx);
    
    // In search mode, search in sheets instead of opening profile
    if (isSearchMode) {
      searchInSheets(profiles[idx].name);
    } else {
      openProfileDirect(profiles[idx]);
    }
    scrollToActiveProfile();
  }

  function selectProfileWithoutHistory(idx) {
    selectProfileCore(idx);
  }

  function selectProfileCore(idx) {
    if (idx < 0 || idx >= profiles.length) return;
    document.querySelectorAll('.profile-item').forEach(i => i.classList.remove('active'));
    const item = profilesList.querySelector(`.profile-item[data-index="${idx}"]`);
    if (item) {
      item.classList.add('active');
      currentProfileIndex = idx;
      const p = profiles[idx];
      currentProfileElement.textContent = p.name;
      currentUrlElement.textContent = `${p.platform}: ${p.url}`;
      updateProfileStatusColor(p.url);
      yesButton.disabled = false;
      noButton.disabled = false;
      updateStats();
    }
  }

  function scrollToActiveProfile() {
    const active = profilesList.querySelector('.profile-item.active');
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function updateProfileStatusColor(url) {
    currentProfileElement.classList.remove('yes', 'no');
    if (profileChoices[url]) {
      currentProfileElement.classList.add(profileChoices[url].toLowerCase());
      const item = profilesList.querySelector(`.profile-item[data-url="${url}"]`);
      if (item) { item.classList.remove('yes', 'no'); item.classList.add(profileChoices[url].toLowerCase()); }
    }
  }

  function openProfileDirect(profile) {
    if (!profile?.url) return;
    showStatusMessage(`Opening ${profile.name}...`, 'info');
    chrome.runtime.sendMessage({
      action: 'openProfile',
      url: profile.url,
      name: profile.name,
      platform: profile.platform
    }, r => {
      if (r?.success) { preloadedUrls.add(profile.url); displayProfiles(profiles); }
    });
  }

  function logChoice(idx, choice) {
    const profile = profiles[idx];
    showStatusMessage(`Logging ${choice}...`, 'info');
    chrome.runtime.sendMessage({
      action: 'logChoice', profile, choice,
      timestamp: new Date().toISOString()
    }, r => {
      if (r?.success) {
        showStatusMessage(`${choice} logged`, 'success');
        profileChoices[profile.url] = choice;
        updateProfileStatusColor(profile.url);
        chrome.storage.local.set({ profileChoices });
        updateStats();

        // Move to next non-skipped
        let next = idx + 1;
        while (next < profiles.length && skippedProfiles.has(profiles[next].url)) next++;

        if (next < profiles.length) {
          selectProfile(next);
          queueRollingPreload();
        } else if (profiles.length < allProfiles.length) {
          loadMoreProfiles().then(() => {
            if (profiles.length > idx + 1) {
              selectProfile(idx + 1);
              queueRollingPreload();
            }
          });
        }
      } else showStatusMessage(`Error: ${r?.error || 'Unknown'}`, 'error');
    });
  }

  function handleKeyPress(e) {
    if (!profiles.length || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.key.toLowerCase()) {
      case 'y': if (currentProfileIndex >= 0) logChoice(currentProfileIndex, 'YES'); break;
      case 'n': if (currentProfileIndex >= 0) logChoice(currentProfileIndex, 'NO'); break;
      case 'b': case 'backspace': e.preventDefault(); goBack(); break;
      case 'arrowdown': case 'j': if (currentProfileIndex < profiles.length - 1) selectProfile(currentProfileIndex + 1); break;
      case 'arrowup': case 'k': if (currentProfileIndex > 0) selectProfile(currentProfileIndex - 1); break;
      case 'r': loadAllProfiles(); break;
    }
  }

  function openHistorySheet() {
    chrome.storage.local.get(['logSheetId'], r => {
      if (r.logSheetId) chrome.tabs.create({ url: `https://docs.google.com/spreadsheets/d/${r.logSheetId}/edit` });
      else showStatusMessage('No log sheet', 'error');
    });
  }

  function openProfilesSheet() {
    chrome.storage.local.get(['peopleSheetId'], r => {
      if (r.peopleSheetId) chrome.tabs.create({ url: `https://docs.google.com/spreadsheets/d/${r.peopleSheetId}/edit` });
      else showStatusMessage('No profiles sheet', 'error');
    });
  }

  // Search Mode Functions
  function toggleSearchMode() {
    if (isSearchMode) {
      exitSearchMode();
    } else {
      enterSearchMode();
    }
  }

  function enterSearchMode() {
    isSearchMode = true;
    searchModeButton.classList.add('search-active');
    searchNavBar.classList.add('active');
    profilesContainer.classList.add('search-mode');
    
    // Filter to show only YES profiles
    currentFilter = 'yes';
    statYes.classList.add('active');
    statNo.classList.remove('active');
    statPending.classList.remove('active');
    applyFilter();
    
    // Reset search state
    currentSearchName = '';
    searchMatchTotal = 0;
    searchMatchCurrent = 0;
    updateSearchUI();
    
    showStatusMessage('Search Mode: Click a YES profile to find in Sheets', 'info');
  }

  function exitSearchMode() {
    isSearchMode = false;
    searchModeButton.classList.remove('search-active');
    searchNavBar.classList.remove('active');
    profilesContainer.classList.remove('search-mode');
    
    // Clear search in sheets
    chrome.runtime.sendMessage({ action: 'clearSheetSearch' });
    
    // Reset filter
    currentFilter = null;
    statYes.classList.remove('active');
    statNo.classList.remove('active');
    statPending.classList.remove('active');
    applyFilter();
    
    showStatusMessage('Exited Search Mode', 'info');
  }

  function updateSearchUI() {
    if (currentSearchName) {
      searchCurrentName.value = currentSearchName;
    } else {
      searchCurrentName.value = '';
    }
    
    if (searchMatchTotal > 0) {
      searchMatchCounter.textContent = `Match ${searchMatchCurrent} of ${searchMatchTotal}`;
      searchPrevBtn.disabled = false;
      searchNextBtn.disabled = false;
    } else if (currentSearchName) {
      searchMatchCounter.textContent = 'No matches found';
      searchPrevBtn.disabled = true;
      searchNextBtn.disabled = true;
    } else {
      searchMatchCounter.textContent = 'No search active';
      searchPrevBtn.disabled = true;
      searchNextBtn.disabled = true;
    }
  }

  function searchInSheets(name) {
    currentSearchName = name;
    searchMatchTotal = 0;
    searchMatchCurrent = 0;
    updateSearchUI();
    
    showStatusMessage(`Searching for "${name}"...`, 'info');
    
    chrome.runtime.sendMessage({
      action: 'searchInSheets',
      name: name
    }, response => {
      if (response?.found) {
        searchMatchTotal = response.total;
        searchMatchCurrent = response.current;
        showStatusMessage(`Found ${response.total} match(es)`, 'success');
      } else if (response?.message) {
        showStatusMessage(response.message, 'info');
      } else {
        showStatusMessage('No matches found', 'info');
      }
      updateSearchUI();
    });
  }

  function searchNextMatch() {
    chrome.runtime.sendMessage({ action: 'sheetsNextMatch' }, response => {
      if (response?.found) {
        searchMatchTotal = response.total;
        searchMatchCurrent = response.current;
        updateSearchUI();
      }
    });
  }

  function searchPrevMatch() {
    chrome.runtime.sendMessage({ action: 'sheetsPrevMatch' }, response => {
      if (response?.found) {
        searchMatchTotal = response.total;
        searchMatchCurrent = response.current;
        updateSearchUI();
      }
    });
  }

  function queueRollingPreload() {
    // Preload next 3 pending profiles
    const lookAhead = 3;
    const startIndex = Math.max(0, currentProfileIndex);
    const toPreload = [];

    for (let i = startIndex; i < profiles.length && toPreload.length < lookAhead; i++) {
      const p = profiles[i];
      if (!preloadedUrls.has(p.url) && !profileChoices[p.url] && !skippedProfiles.has(p.url)) {
        toPreload.push(p);
      }
    }

    if (toPreload.length === 0) return;

    // Small delay between fetches to be gentle
    let i = 0;
    function next() {
      if (i < toPreload.length) {
        const profile = toPreload[i];
        fetch(profile.url, { credentials: 'include' })
          .finally(() => {
            preloadedUrls.add(profile.url);
            updateProfileIndicator(profile.url);
            i++;
            setTimeout(next, 600);
          });
      }
    }
    next();
  }

  function updateProfileIndicator(url) {
    const item = profilesList.querySelector(`.profile-item[data-url="${url}"]`);
    if (item) {
      const indicators = item.querySelector('.profile-indicators');
      if (indicators && !indicators.querySelector('.preload-dot')) {
        indicators.innerHTML = '<div class="preload-dot" title="Preloaded"></div>';
      }
    }
  }

  function shortenUrl(url) {
    try { const u = new URL(url); return u.hostname + u.pathname.substring(0, 18) + (u.pathname.length > 18 ? '...' : ''); }
    catch { return url.substring(0, 25) + (url.length > 25 ? '...' : ''); }
  }

  function showStatusMessage(msg, type) {
    statusMessage.textContent = msg;
    statusMessage.className = type;
    statusMessage.style.display = 'block';
    setTimeout(() => statusMessage.style.display = 'none', 2000);
  }
});
