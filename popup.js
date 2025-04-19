document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const clearBtn = document.getElementById('clearBtn');
  const saveApiKeyBtn = document.getElementById('saveApiKey');
  const apiKeyInput = document.getElementById('apiKey');
  const statusContainer = document.getElementById('statusContainer');
  const statusText = document.getElementById('statusText');
  
  chrome.storage.local.get(["claudeApiKey"], function(result) {
    if (result.claudeApiKey) {
      apiKeyInput.value = result.claudeApiKey;
    }
  });
  
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = tabs[0].url;
    
    chrome.storage.local.get([currentUrl], function(result) {
      if (result[currentUrl]) {
        const analysisData = result[currentUrl].analysis;
        updateStatusDisplay(analysisData);
      }
    });
  });
  
  saveApiKeyBtn.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.local.set({claudeApiKey: apiKey}, function() {
        showTemporaryMessage('API key saved successfully!');
      });
    } else {
      showTemporaryMessage('Please enter a valid API key.');
    }
  });
  
  analyzeBtn.addEventListener('click', function() {
    chrome.storage.local.get(["claudeApiKey"], function(result) {
      if (!result.claudeApiKey) {
        updateStatusDisplay({
          status: "error",
          explanation: "Please set your Claude API key first."
        });
        return;
      }
      
      statusContainer.className = "status unknown";
      statusText.textContent = "Analyzing page...";
      
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: "manualAnalyze"});
        
        const currentUrl = tabs[0].url;
        const checkInterval = setInterval(function() {
          chrome.storage.local.get([currentUrl], function(result) {
            if (result[currentUrl] && 
                result[currentUrl].timestamp > Date.now() - 30000) { // Check if result is recent (within 30 seconds)
              clearInterval(checkInterval);
              updateStatusDisplay(result[currentUrl].analysis);
            }
          });
        }, 1000);
        
        setTimeout(function() {
          clearInterval(checkInterval);
          if (statusText.textContent === "Analyzing page...") {
            updateStatusDisplay({
              status: "error",
              explanation: "Analysis timed out. Please try again."
            });
          }
        }, 30000);
      });
    });
  });
  
  // Clear results for current page
  clearBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = tabs[0].url;
      chrome.storage.local.remove([currentUrl], function() {
        statusContainer.className = "status unknown";
        statusText.textContent = "Current page has not been analyzed yet.";
      });
    });
  });
  
  function updateStatusDisplay(analysis) {
    console.log('Updating status display:', analysis);
    if (!analysis) return;
    
    switch (analysis.status) {
      case "suspicious":
        statusContainer.className = "status suspicious";
        statusText.textContent = "⚠️ Warning: " + analysis.explanation;
        break;
      case "safe":
        statusContainer.className = "status safe";
        statusText.textContent = "✓ Page appears safe: " + analysis.explanation;
        break;
      case "error":
        statusContainer.className = "status unknown";
        statusText.textContent = "⚠️ Analysis failed: " + analysis.explanation;
        break;
      case "ignored":
        statusContainer.className = "status ignored";
        statusText.textContent = "🚫 Ignore: " + analysis.explanation;
        break;
      default:
        statusContainer.className = "status unknown";
        statusText.textContent = "Unknown status: " + analysis.explanation;
    }
  }
  
  function showTemporaryMessage(message) {
    const originalClassName = statusContainer.className;
    const originalText = statusText.textContent;
    
    statusContainer.className = "status";
    statusText.textContent = message;
    
    setTimeout(function() {
      statusContainer.className = originalClassName;
      statusText.textContent = originalText;
    }, 2000);
  }
}); 
