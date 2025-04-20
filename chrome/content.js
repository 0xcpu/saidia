// Define a unique log prefix constant for this file
const CONTENT_LOG_PREFIX = "[saidia]";

/**
 * Helper function for consistent logging with timestamps
 * @param {string} level - Log level ('log', 'error', 'warn')
 * @param {string} message - Message to log
 * @param  {...any} args - Additional arguments to log
 */
function saidiaLog(level, message, ...args) {
  const timestamp = new Date().toISOString();
  switch(level) {
    case 'error':
      console.error(`${CONTENT_LOG_PREFIX} [${timestamp}] ${message}`, ...args);
      break;
    case 'warn':
      console.warn(`${CONTENT_LOG_PREFIX} [${timestamp}] ${message}`, ...args);
      break;
    default:
      console.log(`${CONTENT_LOG_PREFIX} [${timestamp}] ${message}`, ...args);
  }
}

/**
 * Reads browser history and bookmarks to create a dynamic domain ignorelist
 * @param {Object} options Configuration options
 * @returns {Set} Set of domains to ignore
 */
async function createDynamicIgnoreList(options = {}) {
  // Default options
  const defaults = {
    historyDaysToAnalyze: 30,
    minVisitsForIgnore: 5,
    maxDomainsInList: 500,
    combinePredefinedDomains: true
  };
  
  const settings = { ...defaults, ...options };
  const domainFrequency = new Map();
  
  // Request history data from background script instead of direct access
  chrome.runtime.sendMessage({ 
    action: 'getHistoryData', 
    daysToAnalyze: settings.historyDaysToAnalyze 
  }, response => {
    if (response && response.historyItems) {
      // Process history items
      for (const item of response.historyItems) {
        try {
          const domain = new URL(item.url).hostname;
          domainFrequency.set(domain, (domainFrequency.get(domain) || 0) + 1);
        } catch (e) {
          saidiaLog('error', 'Error processing URL:', e);
        }
      }
    }
    
    // Also request bookmark data from background script
    chrome.runtime.sendMessage({ action: 'getBookmarkData' }, response => {
      if (response && response.bookmarks) {
        // Process bookmarks from response
        function processBookmarks(nodes) {
          for (const node of nodes) {
            if (node.url) {
              try {
                const domain = new URL(node.url).hostname;
                // Bookmarks get extra weight (equivalent to 3 visits)
                domainFrequency.set(domain, (domainFrequency.get(domain) || 0) + 3);
              } catch (e) {
                saidiaLog('error', 'Error processing bookmark URL:', e);
              }
            }
            if (node.children) {
              processBookmarks(node.children);
            }
          }
        }
        
        processBookmarks(response.bookmarks);
      }
      
      // Create ignorelist from frequent domains
      const ignoreList = new Set();
      
      // Get the most frequently visited domains
      const sortedDomains = Array.from(domainFrequency.entries())
        .filter(([_, count]) => count >= settings.minVisitsForIgnore)
        .sort((a, b) => b[1] - a[1])
        .slice(0, settings.maxDomainsInList)
        .map(([domain]) => domain);
      
      sortedDomains.forEach(domain => ignoreList.add(domain));
      
      // Persist the ignore list
      try {
        saidiaLog('log', 'Saving ignore list with length:', ignoreList.size);
        chrome.storage.local.set({ 
          dynamicIgnoreList: Array.from(ignoreList),
          ignoreListLastUpdated: new Date().toISOString()
        });
      } catch (e) {
        saidiaLog('error', 'Error saving dynamic ignore list:', e);
      }
    });
  });
  
  return new Set(); // Return empty set immediately, actual data will be saved async
}

/**
 * Checks if a URL's domain is in the dynamic ignore list
 * @param {string} url URL to check
 * @returns {boolean} True if domain should be ignored
 */
async function shouldIgnoreDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    
    // Check cached ignore list
    const stored = await chrome.storage.local.get("dynamicIgnoreList");
    if (stored.dynamicIgnoreList) {
      const isIgnored = stored.dynamicIgnoreList.includes(hostname);
      saidiaLog('log', 'Domain ignored:', hostname, isIgnored);
      return isIgnored;
    }
    
    return false;
  } catch (e) {
    saidiaLog('error', 'Error checking ignore list:', e);
    return false;
  }
}

/**
 * Refreshes the ignore list if it's outdated
 * @param {number} intervalDays Days between refreshes
 */
async function refreshIgnoreList(intervalDays = 7) {
  try {
    const stored = await chrome.storage.local.get(["ignoreListLastUpdated"]);
    saidiaLog('log', 'Stored ignore list last updated:', stored.ignoreListLastUpdated);
    
    // Create list if it doesn't exist
    if (!stored.ignoreListLastUpdated) {
      saidiaLog('log', 'Creating dynamic ignore list');
      createDynamicIgnoreList();
      return;
    }
    
    // Check if list needs refreshing
    const lastUpdated = new Date(stored.ignoreListLastUpdated);
    const daysElapsed = (new Date() - lastUpdated) / (1000 * 60 * 60 * 24);
    
    if (daysElapsed >= intervalDays) {
      saidiaLog('log', 'Refreshing old ignore list');
      createDynamicIgnoreList();
    }
  } catch (e) {
    saidiaLog('error', 'Error refreshing ignore list:', e);
  }
}

/**
 * Initializes and schedules updates for the ignore list
 */
function initializeIgnoreList() {
  // Initial setup
  refreshIgnoreList();
  
  // Set up daily refresh
  setInterval(() => refreshIgnoreList(), 24 * 60 * 60 * 1000);
}

// Function to extract relevant page data
function extractPageData() {
  return {
    url: window.location.href,
    title: document.title,
    metaDescription: document.querySelector('meta[name="description"]')?.content || '',
    bodyText: document.body.innerText.substring(0, 5000),
    links: Array.from(document.querySelectorAll('a')).map(a => a.href).slice(0, 50)
  };
}

/**
 * Analyzes the current page
 */
async function analyzeCurrentPage() {
  const pageData = extractPageData();

  const isIgnored = await shouldIgnoreDomain(pageData.url);

  if (isIgnored) {
    saidiaLog('log', 'Ignoring domain:', pageData.url);
    chrome.runtime.sendMessage({ action: 'ignorePage', pageData });
  } else {
    saidiaLog('log', 'Analyzing domain:', pageData.url);
    chrome.runtime.sendMessage({ action: 'analyzePage', pageData }, response => {
      if (response) {
        if (response.status === "suspicious") {
          showWarningBanner(response.explanation);
          saidiaLog('log', 'Showing warning banner');
        } else if (response.status === "error") {
          showErrorBanner(response.explanation);
          saidiaLog('log', 'Showing error banner');
        } else {
          saidiaLog('log', 'Showing no banner');
        }
      }
    });
  }
}

/**
 * Shows a warning banner if the page is flagged as suspicious
 * @param {string} explanation The explanation for the warning
 */
function showWarningBanner(explanation) {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    background-color: #ff3b30;
    color: white;
    padding: 15px;
    font-size: 16px;
    text-align: center;
    z-index: 999999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  
  const message = document.createElement('p');
  message.textContent = "⚠️ Warning: This page has been flagged as potentially suspicious.";
  banner.appendChild(message);
  
  const details = document.createElement('p');
  details.style.fontSize = "14px";
  details.textContent = explanation || "The content on this page may be misleading or harmful.";
  banner.appendChild(details);
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = "Dismiss";
  closeBtn.style.cssText = `
    background: white;
    color: #ff3b30;
    border: none;
    padding: 5px 15px;
    margin-top: 10px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  `;
  closeBtn.onclick = () => banner.remove();
  banner.appendChild(closeBtn);
  
  document.body.appendChild(banner);
}

// Shows error banner when analysis fails
function showErrorBanner(explanation) {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    background-color: #ff9500;
    color: white;
    padding: 15px;
    font-size: 16px;
    text-align: center;
    z-index: 999999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  
  const message = document.createElement('p');
  message.textContent = "⚠️ Notice: Failed to analyze this page.";
  banner.appendChild(message);
  
  const details = document.createElement('p');
  details.style.fontSize = "14px";
  details.textContent = explanation || "Could not determine if this page is safe or suspicious.";
  banner.appendChild(details);
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = "Dismiss";
  closeBtn.style.cssText = `
    background: white;
    color: #ff9500;
    border: none;
    padding: 5px 15px;
    margin-top: 10px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  `;
  closeBtn.onclick = () => banner.remove();
  banner.appendChild(closeBtn);
  
  document.body.appendChild(banner);
}

/**
 * Shows an ignore banner
 */
function showIgnoreBanner() {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    background-color: #0071e3;
    color: white;
    padding: 15px;
    font-size: 16px;
    text-align: center;
    z-index: 999999;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;

  const message = document.createElement('p');
  message.textContent = "🚫 Ignore: This page has been ignored.";
  banner.appendChild(message);

  document.body.appendChild(banner);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = "Dismiss";
  closeBtn.style.cssText = `
    background: white;
    color: #0071e3;
    border: none;
    padding: 5px 15px;
    margin-top: 10px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  `;
  closeBtn.onclick = () => banner.remove();
  banner.appendChild(closeBtn);

  document.body.appendChild(banner);
}

// Content script that runs on every page
saidiaLog('log', 'Content script loaded');
initializeIgnoreList();
saidiaLog('log', 'Ignore list initialized');

// Run analysis when page is fully loaded
window.addEventListener('load', () => {
  // Wait a moment for dynamic content to load
  setTimeout(analyzeCurrentPage, 1500);
});

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'manualAnalyze') {
    analyzeCurrentPage();
  }
  return true;
}); 