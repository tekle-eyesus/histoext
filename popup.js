/**
 * ChronoHistory - Search Chrome History by Date
 * Core Extension Logic
 */

(() => {
  // --- State ---
  let currentDate = new Date();
  let isRangeMode = false;
  let rangeStartDate = null;
  let rangeEndDate = null;

  let allHistoryItems = [];
  let filteredItems = [];
  let currentKeyword = "";
  let currentTimeFilter = "all"; // 'all', 'morning', 'afternoon', 'evening', 'night'
  let currentDomainFilter = null;
  let currentViewMode = "timeline"; // 'timeline', 'domains', 'flat'

  // --- DOM Elements ---
  const dateInput = document.getElementById("date-input");
  const dateFormattedText = document.getElementById("date-formatted-text");
  const dateWeekdayBadge = document.getElementById("date-weekday-badge");
  const naturalDateInput = document.getElementById("natural-date-input");
  const btnNaturalJump = document.getElementById("btn-natural-jump");
  const btnPrevDay = document.getElementById("btn-prev-day");
  const btnNextDay = document.getElementById("btn-next-day");
  const btnToday = document.getElementById("btn-today");
  const btnYesterday = document.getElementById("btn-yesterday");

  const btnModeSingle = document.getElementById("btn-mode-single");
  const btnModeRange = document.getElementById("btn-mode-range");
  const rangeInputsContainer = document.getElementById("range-inputs-container");
  const rangeStartInput = document.getElementById("range-start-date");
  const rangeEndInput = document.getElementById("range-end-date");
  const btnApplyRange = document.getElementById("btn-apply-range");

  const keywordSearchInput = document.getElementById("keyword-search");
  const btnClearSearch = document.getElementById("btn-clear-search");
  const timeFilterPills = document.querySelectorAll(".pill-btn");

  const domainFiltersBar = document.getElementById("domain-filters-bar");
  const domainPillsList = document.getElementById("domain-pills-list");

  const viewTimelineBtn = document.getElementById("view-timeline");
  const viewDomainsBtn = document.getElementById("view-domains");
  const viewFlatBtn = document.getElementById("view-flat");

  const statsSummary = document.getElementById("stats-summary");
  const resultsList = document.getElementById("results-list");
  const loadingState = document.getElementById("loading-state");
  const emptyState = document.getElementById("empty-state");
  const emptyMessage = document.getElementById("empty-message");

  const btnEmptyToday = document.getElementById("btn-empty-today");
  const btnEmptyPrev = document.getElementById("btn-empty-prev");

  const btnExportCsv = document.getElementById("btn-export-csv");
  const btnExportJson = document.getElementById("btn-export-json");
  const btnDeleteDay = document.getElementById("btn-delete-day");
  const btnExpandTab = document.getElementById("btn-expand-tab");
  const btnThemeToggle = document.getElementById("btn-theme-toggle");
  const toast = document.getElementById("toast");

  // --- Initialization ---
  document.addEventListener("DOMContentLoaded", () => {
    checkFullscreenMode();
    loadPreferences();
    initializeDate();
    setupEventListeners();
    fetchHistoryForCurrentSelection();
  });

  // --- Fullscreen / Tab Mode Detection ---
  function checkFullscreenMode() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("fullscreen") === "1" || window.innerWidth > 750) {
      document.body.classList.add("fullscreen");
      if (btnExpandTab) {
        btnExpandTab.title = "Viewing in Tab";
        btnExpandTab.style.opacity = "0.5";
      }
    }
  }

  // --- User Preferences & Theme ---
  function loadPreferences() {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["theme", "viewMode"], (res) => {
        if (res.theme) {
          applyTheme(res.theme);
        }
        if (res.viewMode) {
          setViewMode(res.viewMode);
        }
      });
    }
  }

  function applyTheme(theme) {
    document.body.classList.remove("theme-dark", "theme-light", "theme-system");
    document.body.classList.add(theme);
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ theme });
    }
  }

  function toggleTheme() {
    const isDark = document.body.classList.contains("theme-dark") ||
      (document.body.classList.contains("theme-system") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const newTheme = isDark ? "theme-light" : "theme-dark";
    applyTheme(newTheme);
    showToast(`Switched to ${newTheme === "theme-dark" ? "Dark" : "Light"} theme`);
  }

  // --- Date Initialization & Formatting ---
  function initializeDate() {
    // Default to today
    setCurrentDate(new Date());
  }

  function formatDateToYMD(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function setCurrentDate(dateObj) {
    currentDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const ymd = formatDateToYMD(currentDate);
    dateInput.value = ymd;
    updateDateDisplay();
  }

  function updateDateDisplay() {
    if (isRangeMode && rangeStartDate && rangeEndDate) {
      const opts = { month: "short", day: "numeric", year: "numeric" };
      const sStr = rangeStartDate.toLocaleDateString(undefined, opts);
      const eStr = rangeEndDate.toLocaleDateString(undefined, opts);
      dateWeekdayBadge.textContent = "Date Range";
      dateFormattedText.textContent = `${sStr} — ${eStr}`;
      return;
    }

    const todayYMD = formatDateToYMD(new Date());
    const currentYMD = formatDateToYMD(currentDate);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayYMD = formatDateToYMD(yesterday);

    let relativeLabel = "Selected Date";
    if (currentYMD === todayYMD) {
      relativeLabel = "Today";
    } else if (currentYMD === yesterdayYMD) {
      relativeLabel = "Yesterday";
    }

    dateWeekdayBadge.textContent = relativeLabel;

    const weekday = currentDate.toLocaleDateString(undefined, { weekday: "long" });
    const fullDate = currentDate.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric"
    });

    dateFormattedText.textContent = `${weekday}, ${fullDate}`;
  }

  // --- Natural / Free-text Date Parser ---
  function parseNaturalDate(inputStr) {
    if (!inputStr) return null;
    const clean = inputStr.trim().toLowerCase();

    const now = new Date();
    if (clean === "today") {
      return now;
    }
    if (clean === "yesterday") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d;
    }
    if (clean === "day before yesterday") {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      return d;
    }

    // e.g. "3 days ago"
    const daysAgoMatch = clean.match(/^(\d+)\s+days?\s+ago$/);
    if (daysAgoMatch) {
      const d = new Date();
      d.setDate(d.getDate() - parseInt(daysAgoMatch[1], 10));
      return d;
    }

    // e.g. "last week", "1 week ago"
    if (clean === "last week" || clean === "1 week ago") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d;
    }

    // Direct Date.parse
    const timestamp = Date.parse(inputStr);
    if (!isNaN(timestamp)) {
      return new Date(timestamp);
    }

    return null;
  }

  function handleNaturalJump() {
    const val = naturalDateInput.value;
    if (!val) return;
    const parsed = parseNaturalDate(val);
    if (parsed) {
      if (isRangeMode) {
        setSingleDateMode();
      }
      setCurrentDate(parsed);
      naturalDateInput.value = "";
      fetchHistoryForCurrentSelection();
      showToast(`Jumped to ${formatDateToYMD(parsed)}`);
    } else {
      showToast("Could not recognize date format. Try 'Oct 30, 2026' or '2026-10-30'.");
    }
  }

  // --- Range Mode Controls ---
  function setSingleDateMode() {
    isRangeMode = false;
    btnModeSingle.classList.add("active");
    btnModeRange.classList.remove("active");
    rangeInputsContainer.classList.add("hidden");
    btnPrevDay.disabled = false;
    btnNextDay.disabled = false;
    btnPrevDay.style.opacity = "1";
    btnNextDay.style.opacity = "1";
    updateDateDisplay();
  }

  function setRangeMode() {
    isRangeMode = true;
    btnModeRange.classList.add("active");
    btnModeSingle.classList.remove("active");
    rangeInputsContainer.classList.remove("hidden");
    btnPrevDay.disabled = true;
    btnNextDay.disabled = true;
    btnPrevDay.style.opacity = "0.4";
    btnNextDay.style.opacity = "0.4";

    // Set default range: last 7 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 6);

    rangeStartInput.value = formatDateToYMD(start);
    rangeEndInput.value = formatDateToYMD(end);
    rangeStartDate = start;
    rangeEndDate = end;

    updateDateDisplay();
    fetchHistoryForCurrentSelection();
  }

  // --- History Fetching Logic ---
  async function fetchHistoryForCurrentSelection() {
    setLoading(true);

    let startTime, endTime;

    if (isRangeMode && rangeStartDate && rangeEndDate) {
      startTime = new Date(rangeStartDate.getFullYear(), rangeStartDate.getMonth(), rangeStartDate.getDate(), 0, 0, 0, 0).getTime();
      endTime = new Date(rangeEndDate.getFullYear(), rangeEndDate.getMonth(), rangeEndDate.getDate(), 23, 59, 59, 999).getTime();
    } else {
      startTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0).getTime();
      endTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59, 999).getTime();
    }

    try {
      if (typeof chrome === "undefined" || !chrome.history) {
        // Fallback demo mock data if run outside Chrome extension context for testing
        allHistoryItems = generateMockHistory(startTime, endTime);
        processAndRenderHistory();
        return;
      }

      // 1. Fetch URLs matching the range
      const searchResults = await new Promise((resolve) => {
        chrome.history.search(
          {
            text: "",
            startTime: startTime,
            endTime: endTime,
            maxResults: 5000
          },
          (items) => resolve(items || [])
        );
      });

      // 2. Fetch specific visits for each URL in this time range to get accurate timestamps
      const enrichedItems = [];
      const batchSize = 40;

      for (let i = 0; i < searchResults.length; i += batchSize) {
        const batch = searchResults.slice(i, i + batchSize);
        const batchPromises = batch.map(async (item) => {
          try {
            const visits = await new Promise((res) => {
              chrome.history.getVisits({ url: item.url }, (v) => res(v || []));
            });

            // Filter visits within the day/range
            const matchingVisits = visits.filter(
              (v) => v.visitTime >= startTime && v.visitTime <= endTime
            );

            if (matchingVisits.length > 0) {
              // Add an entry for each matching visit
              return matchingVisits.map((v) => ({
                id: `${item.id}-${v.visitTime}`,
                url: item.url,
                title: item.title || extractDomain(item.url),
                visitTime: v.visitTime,
                domain: extractDomain(item.url),
                transition: v.transition,
                typedCount: item.typedCount || 0
              }));
            } else if (item.lastVisitTime >= startTime && item.lastVisitTime <= endTime) {
              return [{
                id: item.id,
                url: item.url,
                title: item.title || extractDomain(item.url),
                visitTime: item.lastVisitTime,
                domain: extractDomain(item.url),
                transition: "link",
                typedCount: item.typedCount || 0
              }];
            }
            return [];
          } catch (e) {
            return [{
              id: item.id,
              url: item.url,
              title: item.title || extractDomain(item.url),
              visitTime: item.lastVisitTime || startTime,
              domain: extractDomain(item.url),
              transition: "link"
            }];
          }
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.flat().forEach((entry) => enrichedItems.push(entry));
      }

      // Sort chronological descending (most recent first)
      enrichedItems.sort((a, b) => b.visitTime - a.visitTime);

      allHistoryItems = enrichedItems;
      processAndRenderHistory();
    } catch (err) {
      console.error("Failed to query history:", err);
      showToast("Error reading history. Ensure permissions are granted.");
      setLoading(false);
    }
  }

  function extractDomain(urlStr) {
    try {
      const u = new URL(urlStr);
      return u.hostname.replace(/^www\./, "");
    } catch {
      return "other";
    }
  }

  // --- Filtering & Sorting ---
  function processAndRenderHistory() {
    setLoading(false);

    let items = allHistoryItems;

    // 1. Keyword search filter
    if (currentKeyword.trim()) {
      const q = currentKeyword.trim().toLowerCase();
      items = items.filter(
        (it) =>
          (it.title && it.title.toLowerCase().includes(q)) ||
          (it.url && it.url.toLowerCase().includes(q)) ||
          (it.domain && it.domain.toLowerCase().includes(q))
      );
    }

    // 2. Time-of-day filter
    if (currentTimeFilter !== "all") {
      items = items.filter((it) => {
        const hour = new Date(it.visitTime).getHours();
        switch (currentTimeFilter) {
          case "morning":
            return hour >= 6 && hour < 12;
          case "afternoon":
            return hour >= 12 && hour < 18;
          case "evening":
            return hour >= 18 && hour < 22;
          case "night":
            return hour >= 22 || hour < 6;
          default:
            return true;
        }
      });
    }

    // 3. Domain filter
    if (currentDomainFilter) {
      items = items.filter((it) => it.domain === currentDomainFilter);
    }

    filteredItems = items;

    // Update Top Domains list based on allHistoryItems
    renderDomainFilterPills();

    // Render Stats
    updateStatsBar();

    // Render Items
    if (filteredItems.length === 0) {
      resultsList.innerHTML = "";
      emptyState.classList.remove("hidden");
      if (currentKeyword || currentDomainFilter || currentTimeFilter !== "all") {
        emptyMessage.textContent = "No visits match your active filters or search keyword.";
      } else {
        emptyMessage.textContent = `No web pages were visited on ${dateFormattedText.textContent}.`;
      }
    } else {
      emptyState.classList.add("hidden");
      renderCurrentView();
    }
  }

  // --- Domain Filter Bar ---
  function renderDomainFilterPills() {
    const domainCounts = {};
    allHistoryItems.forEach((it) => {
      domainCounts[it.domain] = (domainCounts[it.domain] || 0) + 1;
    });

    const sortedDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    if (sortedDomains.length <= 1) {
      domainFiltersBar.classList.add("hidden");
      return;
    }

    domainFiltersBar.classList.remove("hidden");
    domainPillsList.innerHTML = "";

    // "All" pill
    const allPill = document.createElement("button");
    allPill.className = `domain-pill ${!currentDomainFilter ? "active" : ""}`;
    allPill.innerHTML = `All Sites <span class="pill-count">${allHistoryItems.length}</span>`;
    allPill.addEventListener("click", () => {
      currentDomainFilter = null;
      processAndRenderHistory();
    });
    domainPillsList.appendChild(allPill);

    sortedDomains.forEach(([dom, count]) => {
      const pill = document.createElement("button");
      pill.className = `domain-pill ${currentDomainFilter === dom ? "active" : ""}`;
      pill.innerHTML = `${dom} <span class="pill-count">${count}</span>`;
      pill.addEventListener("click", () => {
        currentDomainFilter = currentDomainFilter === dom ? null : dom;
        processAndRenderHistory();
      });
      domainPillsList.appendChild(pill);
    });
  }

  function updateStatsBar() {
    const totalCount = filteredItems.length;
    const uniqueDomains = new Set(filteredItems.map((i) => i.domain)).size;

    statsSummary.innerHTML = `
      Showing <strong>${totalCount}</strong> visits across <strong>${uniqueDomains}</strong> sites
    `;
  }

  // --- Render Views ---
  function renderCurrentView() {
    resultsList.innerHTML = "";

    if (currentViewMode === "timeline") {
      renderTimelineView();
    } else if (currentViewMode === "domains") {
      renderDomainsView();
    } else {
      renderFlatListView();
    }
  }

  // 1. Timeline View (Grouped by Hour)
  function renderTimelineView() {
    // Group items by hour
    const hourGroups = {};

    filteredItems.forEach((item) => {
      const d = new Date(item.visitTime);
      const hour = d.getHours();
      if (!hourGroups[hour]) {
        hourGroups[hour] = [];
      }
      hourGroups[hour].push(item);
    });

    // Hours descending (e.g. 23 down to 0)
    const sortedHours = Object.keys(hourGroups).map(Number).sort((a, b) => b - a);

    sortedHours.forEach((hour) => {
      const groupEl = document.createElement("div");
      groupEl.className = "timeline-hour-group";

      const hourLabel = formatHourRange(hour);
      const count = hourGroups[hour].length;

      groupEl.innerHTML = `
        <div class="timeline-hour-header">
          <div class="timeline-hour-badge">${hourLabel}</div>
          <div class="timeline-hour-line"></div>
          <div class="timeline-hour-count">${count} visit${count > 1 ? "s" : ""}</div>
        </div>
        <div class="timeline-items-wrapper"></div>
      `;

      const itemsWrapper = groupEl.querySelector(".timeline-items-wrapper");
      hourGroups[hour].forEach((it) => {
        itemsWrapper.appendChild(createHistoryCard(it));
      });

      resultsList.appendChild(groupEl);
    });
  }

  // 2. Domain Grouped View
  function renderDomainsView() {
    const domainGroups = {};
    filteredItems.forEach((item) => {
      if (!domainGroups[item.domain]) {
        domainGroups[item.domain] = [];
      }
      domainGroups[item.domain].push(item);
    });

    const sortedDomains = Object.keys(domainGroups).sort(
      (a, b) => domainGroups[b].length - domainGroups[a].length
    );

    sortedDomains.forEach((dom) => {
      const items = domainGroups[dom];
      const groupEl = document.createElement("div");
      groupEl.className = "domain-group";

      groupEl.innerHTML = `
        <div class="domain-group-header">
          <div class="domain-group-title">
            <span class="domain-tag">${dom}</span>
          </div>
          <span class="domain-group-count">${items.length} visits</span>
        </div>
        <div class="domain-group-body"></div>
      `;

      const bodyEl = groupEl.querySelector(".domain-group-body");
      items.forEach((it) => {
        bodyEl.appendChild(createHistoryCard(it));
      });

      resultsList.appendChild(groupEl);
    });
  }

  // 3. Flat List View
  function renderFlatListView() {
    filteredItems.forEach((it) => {
      resultsList.appendChild(createHistoryCard(it));
    });
  }

  // --- Create History Card Element ---
  function createHistoryCard(item) {
    const card = document.createElement("div");
    card.className = "history-card";
    card.dataset.id = item.id;
    card.dataset.url = item.url;

    const timeStr = formatVisitTime(item.visitTime);
    const highlightedTitle = highlightSearchTerm(item.title, currentKeyword);
    const highlightedUrl = highlightSearchTerm(truncateUrl(item.url), currentKeyword);

    // Favicon URL
    let faviconUrl = "";
    if (chrome && chrome.runtime && chrome.runtime.getURL) {
      faviconUrl = chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(item.url)}&size=32`);
    } else {
      faviconUrl = `https://www.google.com/s2/favicons?domain=${item.domain}&sz=32`;
    }

    card.innerHTML = `
      <div class="history-card-time">${timeStr}</div>
      <div class="favicon-container">
        <img class="favicon-img" src="${faviconUrl}" alt="" loading="lazy">
      </div>
      <div class="history-card-content">
        <div class="history-card-title-row">
          <a href="${item.url}" class="history-title-link" target="_blank" rel="noopener noreferrer" title="${escapeHtml(item.title)}">
            ${highlightedTitle}
          </a>
        </div>
        <div class="history-meta-row">
          <span class="domain-tag" title="Click to filter by ${item.domain}">${item.domain}</span>
          <span class="history-url-snippet" title="${escapeHtml(item.url)}">${highlightedUrl}</span>
        </div>
      </div>
      <div class="history-card-actions">
        <button class="card-action-btn btn-open" title="Open in new tab">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
        <button class="card-action-btn btn-copy" title="Copy link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="card-action-btn btn-delete" title="Delete from history">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    // Handle Favicon error fallback
    const imgEl = card.querySelector(".favicon-img");
    imgEl.addEventListener("error", () => {
      const fallback = document.createElement("div");
      fallback.className = "favicon-fallback";
      fallback.textContent = (item.domain.charAt(0) || "W").toUpperCase();
      imgEl.replaceWith(fallback);
    });

    // Domain tag filter click
    const domTag = card.querySelector(".domain-tag");
    domTag.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentDomainFilter = item.domain;
      processAndRenderHistory();
    });

    // Action buttons
    const btnOpen = card.querySelector(".btn-open");
    btnOpen.addEventListener("click", (e) => {
      e.stopPropagation();
      openUrl(item.url);
    });

    const btnCopy = card.querySelector(".btn-copy");
    btnCopy.addEventListener("click", (e) => {
      e.stopPropagation();
      copyToClipboard(item.url);
    });

    const btnDelete = card.querySelector(".btn-delete");
    btnDelete.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteHistoryItem(item.url, card);
    });

    return card;
  }

  function openUrl(url) {
    if (chrome && chrome.tabs) {
      chrome.tabs.create({ url, active: true });
    } else {
      window.open(url, "_blank");
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Link copied to clipboard!");
    });
  }

  function deleteHistoryItem(url, cardElement) {
    if (chrome && chrome.history && chrome.history.deleteUrl) {
      chrome.history.deleteUrl({ url }, () => {
        showToast("Removed from history");
        allHistoryItems = allHistoryItems.filter((i) => i.url !== url);
        processAndRenderHistory();
      });
    } else {
      // Mock removal
      allHistoryItems = allHistoryItems.filter((i) => i.url !== url);
      processAndRenderHistory();
      showToast("Removed from history");
    }
  }

  // --- Batch Delete Day ---
  async function deleteDayHistory() {
    const dateLabel = dateFormattedText.textContent;
    const count = filteredItems.length;

    if (count === 0) {
      showToast("No history items to delete on this date.");
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to delete all ${count} browsing history entries for ${dateLabel}? This cannot be undone.`
    );

    if (!confirmed) return;

    setLoading(true);

    let startTime, endTime;
    if (isRangeMode && rangeStartDate && rangeEndDate) {
      startTime = new Date(rangeStartDate.getFullYear(), rangeStartDate.getMonth(), rangeStartDate.getDate(), 0, 0, 0, 0).getTime();
      endTime = new Date(rangeEndDate.getFullYear(), rangeEndDate.getMonth(), rangeEndDate.getDate(), 23, 59, 59, 999).getTime();
    } else {
      startTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0).getTime();
      endTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 23, 59, 59, 999).getTime();
    }

    if (chrome && chrome.history && chrome.history.deleteRange) {
      chrome.history.deleteRange({ startTime, endTime }, () => {
        showToast(`Cleared browsing history for ${dateLabel}`);
        fetchHistoryForCurrentSelection();
      });
    } else {
      allHistoryItems = [];
      processAndRenderHistory();
      showToast(`Cleared browsing history for ${dateLabel}`);
    }
  }

  // --- Exporting CSV / JSON ---
  function exportToCsv() {
    if (filteredItems.length === 0) {
      showToast("Nothing to export for this date.");
      return;
    }

    const headers = ["Date", "Time", "Title", "URL", "Domain"];
    const rows = filteredItems.map((item) => {
      const d = new Date(item.visitTime);
      const dateStr = formatDateToYMD(d);
      const timeStr = formatVisitTime(item.visitTime);
      const safeTitle = `"${(item.title || "").replace(/"/g, '""')}"`;
      const safeUrl = `"${(item.url || "").replace(/"/g, '""')}"`;
      return [dateStr, timeStr, safeTitle, safeUrl, item.domain].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");
    downloadFile(csvContent, `chrome-history-${formatDateToYMD(currentDate)}.csv`, "text/csv;charset=utf-8;");
    showToast("Exported to CSV!");
  }

  function exportToJson() {
    if (filteredItems.length === 0) {
      showToast("Nothing to export for this date.");
      return;
    }

    const dataStr = JSON.stringify(filteredItems, null, 2);
    downloadFile(dataStr, `chrome-history-${formatDateToYMD(currentDate)}.json`, "application/json");
    showToast("Exported to JSON!");
  }

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Native Date Picker
    dateInput.addEventListener("change", (e) => {
      if (e.target.value) {
        const [y, m, d] = e.target.value.split("-").map(Number);
        if (isRangeMode) setSingleDateMode();
        setCurrentDate(new Date(y, m - 1, d));
        fetchHistoryForCurrentSelection();
      }
    });

    // Natural Language Jump
    btnNaturalJump.addEventListener("click", handleNaturalJump);
    naturalDateInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleNaturalJump();
    });

    // Prev / Next Day
    btnPrevDay.addEventListener("click", () => {
      if (isRangeMode) return;
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
      fetchHistoryForCurrentSelection();
    });

    btnNextDay.addEventListener("click", () => {
      if (isRangeMode) return;
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
      fetchHistoryForCurrentSelection();
    });

    // Quick Presets
    btnToday.addEventListener("click", () => {
      if (isRangeMode) setSingleDateMode();
      setCurrentDate(new Date());
      fetchHistoryForCurrentSelection();
    });

    btnYesterday.addEventListener("click", () => {
      if (isRangeMode) setSingleDateMode();
      const d = new Date();
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
      fetchHistoryForCurrentSelection();
    });

    // Mode Toggle
    btnModeSingle.addEventListener("click", () => {
      setSingleDateMode();
      fetchHistoryForCurrentSelection();
    });

    btnModeRange.addEventListener("click", () => {
      setRangeMode();
    });

    btnApplyRange.addEventListener("click", () => {
      if (rangeStartInput.value && rangeEndInput.value) {
        const [sy, sm, sd] = rangeStartInput.value.split("-").map(Number);
        const [ey, em, ed] = rangeEndInput.value.split("-").map(Number);
        rangeStartDate = new Date(sy, sm - 1, sd);
        rangeEndDate = new Date(ey, em - 1, ed);
        updateDateDisplay();
        fetchHistoryForCurrentSelection();
      }
    });

    // Keyword Search
    let debounceTimer;
    keywordSearchInput.addEventListener("input", (e) => {
      currentKeyword = e.target.value;
      btnClearSearch.classList.toggle("hidden", !currentKeyword);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        processAndRenderHistory();
      }, 150);
    });

    btnClearSearch.addEventListener("click", () => {
      keywordSearchInput.value = "";
      currentKeyword = "";
      btnClearSearch.classList.add("hidden");
      processAndRenderHistory();
    });

    // Time Filter Pills
    timeFilterPills.forEach((pill) => {
      pill.addEventListener("click", () => {
        timeFilterPills.forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        currentTimeFilter = pill.dataset.timeFilter;
        processAndRenderHistory();
      });
    });

    // View Mode Switcher
    viewTimelineBtn.addEventListener("click", () => setViewMode("timeline"));
    viewDomainsBtn.addEventListener("click", () => setViewMode("domains"));
    viewFlatBtn.addEventListener("click", () => setViewMode("flat"));

    // Empty state quick actions
    btnEmptyToday.addEventListener("click", () => {
      if (isRangeMode) setSingleDateMode();
      setCurrentDate(new Date());
      fetchHistoryForCurrentSelection();
    });

    btnEmptyPrev.addEventListener("click", () => {
      if (isRangeMode) setSingleDateMode();
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
      fetchHistoryForCurrentSelection();
    });

    // Full Tab Expansion
    btnExpandTab.addEventListener("click", () => {
      if (chrome && chrome.tabs && chrome.runtime) {
        chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?fullscreen=1") });
      } else {
        window.open(window.location.href + "?fullscreen=1", "_blank");
      }
    });

    // Theme Toggle
    btnThemeToggle.addEventListener("click", toggleTheme);

    // Export & Clear
    btnExportCsv.addEventListener("click", exportToCsv);
    btnExportJson.addEventListener("click", exportToJson);
    btnDeleteDay.addEventListener("click", deleteDayHistory);
  }

  function setViewMode(mode) {
    currentViewMode = mode;
    [viewTimelineBtn, viewDomainsBtn, viewFlatBtn].forEach((b) => b.classList.remove("active"));

    if (mode === "timeline") viewTimelineBtn.classList.add("active");
    else if (mode === "domains") viewDomainsBtn.classList.add("active");
    else viewFlatBtn.classList.add("active");

    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ viewMode: mode });
    }

    renderCurrentView();
  }

  function setLoading(isLoading) {
    if (isLoading) {
      loadingState.classList.remove("hidden");
      resultsList.classList.add("hidden");
      emptyState.classList.add("hidden");
    } else {
      loadingState.classList.add("hidden");
      resultsList.classList.remove("hidden");
    }
  }

  // --- Helper Formatting Utilities ---
  function formatVisitTime(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  }

  function formatHourRange(hour) {
    const formatH = (h) => {
      const period = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${h12} ${period}`;
    };
    return `${formatH(hour)} – ${formatH((hour + 1) % 24)}`;
  }

  function truncateUrl(urlStr) {
    try {
      const u = new URL(urlStr);
      return u.pathname + u.search + u.hash;
    } catch {
      return urlStr;
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function highlightSearchTerm(text, term) {
    if (!term || !text) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const regex = new RegExp(`(${escapeRegex(term)})`, "gi");
    return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add("hidden");
    }, 2500);
  }

  // --- Mock Data Generator (for standalone testing in browser) ---
  function generateMockHistory(startTime, endTime) {
    const sampleSites = [
      { title: "GitHub: Let's build from here", url: "https://github.com/explore", domain: "github.com" },
      { title: "Google Search - JavaScript Date formatting", url: "https://www.google.com/search?q=javascript+date", domain: "google.com" },
      { title: "Stack Overflow - Chrome Extension history.search", url: "https://stackoverflow.com/questions/12345/chrome-history", domain: "stackoverflow.com" },
      { title: "YouTube - Lo-Fi Beats to Relax/Study to", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk", domain: "youtube.com" },
      { title: "MDN Web Docs - Chrome Extensions Manifest V3", url: "https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons", domain: "developer.mozilla.org" },
      { title: "Reddit: The front page of the internet", url: "https://www.reddit.com/r/programming", domain: "reddit.com" },
      { title: "Twitter / X - Trending Tech News", url: "https://x.com/home", domain: "x.com" },
      { title: "Wikipedia: Antigravity", url: "https://en.wikipedia.org/wiki/Antigravity", domain: "en.wikipedia.org" }
    ];

    const count = 18;
    const items = [];
    const span = Math.max(1000, endTime - startTime);

    for (let i = 0; i < count; i++) {
      const site = sampleSites[Math.floor(Math.random() * sampleSites.length)];
      const visitTime = startTime + Math.floor(Math.random() * span);
      items.push({
        id: `mock-${i}`,
        url: site.url,
        title: site.title,
        visitTime: visitTime,
        domain: site.domain,
        transition: "link"
      });
    }

    return items.sort((a, b) => b.visitTime - a.visitTime);
  }
})();

