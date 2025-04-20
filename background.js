// Define log prefix as a constant
const BACKGROUND_LOG_PREFIX = '[saidia]';

/**
 * Helper function for consistent logging with timestamps
 * @param {string} level - Log level ('log', 'error', 'warn')
 * @param {string} message - Message to log
 * @param  {...any} args - Additional arguments to log
 */
function saidiaLog(level, message, ...args) {
  const timestamp = new Date().toISOString();
  switch (level) {
    case 'error':
      console.error(`${BACKGROUND_LOG_PREFIX} [${timestamp}] ${message}`, ...args);
      break;
    case 'warn':
      console.warn(`${BACKGROUND_LOG_PREFIX} [${timestamp}] ${message}`, ...args);
      break;
    default:
      console.log(`${BACKGROUND_LOG_PREFIX} [${timestamp}] ${message}`, ...args);
  }
}

// Background service worker for Saidia extension
saidiaLog('log', 'Background script loaded');

// Store your Claude API key safely
// TODO: Move this to a secure storage
let claudeApiKey = '';

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  saidiaLog('log', 'Received message:', message);
  if (message.action === 'ignorePage') {
    saidiaLog('log', 'Page ignored:', message.pageData.url);
    // Cache the result for this URL
    chrome.storage.local.set({
      [message.pageData.url]: {
        analysis: {
          status: 'ignored',
          explanation: 'This page has been ignored as it is found in the ignore list.',
        },
        timestamp: Date.now(),
      },
    });
    sendResponse({
      status: 'ignored',
      explanation: 'This page has been ignored as it is found in the ignore list.',
    });
    return true;
  }

  if (message.action === 'getHistoryData') {
    // Get browser history data
    try {
      const daysToAnalyze = message.daysToAnalyze || 30;
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - daysToAnalyze);

      chrome.history.search(
        {
          text: '',
          startTime: oneMonthAgo.getTime(),
          maxResults: 10000,
        },
        historyItems => {
          sendResponse({ historyItems });
        }
      );

      // Return true to indicate we'll respond asynchronously
      return true;
    } catch (error) {
      saidiaLog('error', 'Error accessing browser history:', error);
      sendResponse({ error: error.message });
      return true;
    }
  }

  if (message.action === 'getBookmarkData') {
    // Get bookmark data
    try {
      chrome.bookmarks.getTree(bookmarks => {
        sendResponse({ bookmarks });
      });

      // Return true to indicate we'll respond asynchronously
      return true;
    } catch (error) {
      saidiaLog('error', 'Error accessing bookmarks:', error);
      sendResponse({ error: error.message });
      return true;
    }
  }

  if (message.action === 'analyzePage') {
    // Check if we have an API key
    chrome.storage.local.get(['claudeApiKey'], result => {
      claudeApiKey = result.claudeApiKey || '';

      if (!claudeApiKey) {
        sendResponse({
          status: 'error',
          explanation: 'API key not set. Please set your Claude API key in the extension settings.',
        });
        return;
      }

      // Analyze page using Claude API
      analyzeWithClaude(message.pageData)
        .then(analysis => {
          sendResponse(analysis);
          // Cache the result for this URL
          chrome.storage.local.set({
            [message.pageData.url]: {
              analysis,
              timestamp: Date.now(),
            },
          });
        })
        .catch(error => {
          saidiaLog('error', 'Error analyzing page:', error);
          sendResponse({
            status: 'error',
            explanation: 'Error analyzing page: ' + error.message,
          });
        });
    });

    // Return true to indicate we'll respond asynchronously
    return true;
  }
});

// Function to analyze page content using Claude API
async function analyzeWithClaude(pageData) {
  try {
    // Prepare the prompt for Claude
    const prompt = `
You are analyzing a web page for suspicious content. Please determine if this page appears to be suspicious, 
misleading, or potentially harmful. Consider factors like:

1. Misinformation
2. Phishing attempts
3. Malware distribution
4. Scam indicators
5. Extreme content
6. Privacy violations

URL: ${pageData.url}
Title: ${pageData.title}
Meta Description: ${pageData.metaDescription}

Page Content Sample:
${pageData.bodyText.substring(0, 3000)}

Sample Links:
${pageData.links.join('\n')}

Based strictly on this information, is this page suspicious? 
Please respond with a JSON object with two fields:
1. "isSuspicious": a boolean (true/false)
2. "explanation": a brief explanation of your assessment (100 words or less)

Example: 
{"isSuspicious": true, "explanation": "This appears to be a phishing page mimicking a bank login."}
OR
{"isSuspicious": false, "explanation": "This appears to be a legitimate news article from a known publisher."}
`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Extract Claude's response
    const claudeResponse = result.content[0].text;

    // Parse the JSON response
    try {
      // Look for JSON in the response (handling potential non-JSON text around it)
      const jsonMatch = claudeResponse.match(/\{.*"isSuspicious".*\}/s);
      if (jsonMatch) {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        return {
          status: parsedResponse.isSuspicious ? 'suspicious' : 'safe',
          isSuspicious: parsedResponse.isSuspicious,
          explanation: parsedResponse.explanation,
        };
      } else {
        // Fallback if Claude didn't return proper JSON
        return {
          status: 'error',
          explanation:
            "Couldn't parse Claude's response properly. Raw response was: " +
            claudeResponse.substring(0, 100) +
            '...',
        };
      }
    } catch (parseError) {
      saidiaLog('error', 'Error parsing Claude response:', parseError);
      return {
        status: 'error',
        explanation:
          'Error parsing analysis result. Claude may not have returned a valid response.',
      };
    }
  } catch (error) {
    saidiaLog('error', 'Error calling Claude API:', error);
    return {
      status: 'error',
      explanation: 'Error connecting to Claude API: ' + error.message,
    };
  }
}

// Initialize extension when installed
chrome.runtime.onInstalled.addListener(() => {
  saidiaLog('log', 'Extension installed');
});
