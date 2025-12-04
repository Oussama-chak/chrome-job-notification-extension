// Popup script for user interaction

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadStats();
  attachEventListeners();
});

// Load current settings from storage
async function loadSettings() {
  const settings = await chrome.storage.sync.get([
    'keywords',
    'checkInterval',
    'enabledSites'
  ]);

  // Populate keywords
  if (settings.keywords) {
    document.getElementById('keywords').value = settings.keywords.join(', ');
  }

  // Populate check interval
  if (settings.checkInterval) {
    document.getElementById('checkInterval').value = settings.checkInterval;
  }

  // Populate enabled sites
  if (settings.enabledSites) {
    const checkboxes = document.querySelectorAll('input[name="site"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = settings.enabledSites.includes(checkbox.value);
    });
  }
}

// Load and display statistics
async function loadStats() {
  const data = await chrome.storage.sync.get(['savedJobs', 'lastChecked']);
  
  // Update total jobs count
  const totalJobs = data.savedJobs ? data.savedJobs.length : 0;
  document.getElementById('totalJobs').textContent = totalJobs;

  // Update last check time
  if (data.lastChecked && Object.keys(data.lastChecked).length > 0) {
    const timestamps = Object.keys(data.lastChecked).map(Number);
    const lastTimestamp = Math.max(...timestamps);
    const lastCheckDate = new Date(lastTimestamp);
    document.getElementById('lastCheck').textContent = formatRelativeTime(lastCheckDate);
  }
}

// Format relative time (e.g., "5 minutes ago")
function formatRelativeTime(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

// Attach event listeners to buttons
function attachEventListeners() {
  // Check Now button
  document.getElementById('checkNowBtn').addEventListener('click', async () => {
    const btn = document.getElementById('checkNowBtn');
    btn.disabled = true;
    btn.textContent = '🔄 Checking...';
    showStatus('Searching for new jobs across all platforms...', 'info');
    
    chrome.runtime.sendMessage({ action: 'checkNow' }, (response) => {
      btn.disabled = false;
      btn.textContent = '🔍 Check Now';
      
      if (response && response.success) {
        showStatus('✓ Check complete! Look for notifications.', 'success');
        loadStats();
      } else {
        showStatus('❌ Error checking jobs. Check console.', 'error');
      }
    });
  });

  // Test Notification button
  document.getElementById('testNotifBtn').addEventListener('click', async () => {
    showStatus('📬 Sending test notification...', 'info');
    
    chrome.runtime.sendMessage({ action: 'testNotification' }, (response) => {
      if (response && response.success) {
        showStatus('✓ Test notification sent!', 'success');
      } else {
        showStatus('❌ Error sending notification', 'error');
      }
    });
  });

  // View Jobs button
  document.getElementById('viewJobsBtn').addEventListener('click', async () => {
    const jobsSection = document.getElementById('jobsSection');
    const isVisible = jobsSection.style.display !== 'none';
    
    if (isVisible) {
      jobsSection.style.display = 'none';
    } else {
      await displaySavedJobs();
      jobsSection.style.display = 'block';
    }
  });

  // Save Settings button
  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const keywords = document.getElementById('keywords').value
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    const checkInterval = parseInt(document.getElementById('checkInterval').value);

    const enabledSites = Array.from(document.querySelectorAll('input[name="site"]:checked'))
      .map(checkbox => checkbox.value);

    const settings = {
      keywords,
      checkInterval,
      enabledSites
    };

    chrome.runtime.sendMessage(
      { action: 'updateSettings', settings },
      (response) => {
        if (response.success) {
          showStatus('✓ Settings saved!', 'success');
        } else {
          showStatus('Error saving settings', 'error');
        }
      }
    );
  });
}

// Display saved jobs
async function displaySavedJobs() {
  const data = await chrome.storage.sync.get('savedJobs');
  const jobs = data.savedJobs || [];
  const jobsList = document.getElementById('jobsList');

  if (jobs.length === 0) {
    jobsList.innerHTML = '<p class="no-jobs">No saved jobs yet</p>';
    return;
  }

  jobsList.innerHTML = jobs.map(job => `
    <div class="job-card">
      <h3 class="job-title">${escapeHtml(job.title)}</h3>
      <p class="job-company">${escapeHtml(job.company)}</p>
      <p class="job-location">📍 ${escapeHtml(job.location)}</p>
      ${job.salary ? `<p class="job-salary">💰 ${escapeHtml(job.salary)}</p>` : ''}
      <p class="job-date">Posted: ${new Date(job.postedDate).toLocaleDateString()}</p>
      <a href="${job.url}" target="_blank" class="job-link">View Job →</a>
    </div>
  `).join('');
}

// Show status message
function showStatus(message, type = 'info') {
  const statusElement = document.getElementById('statusMessage');
  statusElement.textContent = message;
  statusElement.className = `status-message status-${type}`;
  statusElement.style.display = 'block';

  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}