// Service Worker for background tasks
// Monitors job boards and sends notifications

// Initialize extension on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Job Alert Notifier installed');
  
  // Set default settings
  chrome.storage.sync.set({
    keywords: ['developer', 'engineer', 'frontend'],
    checkInterval: 30, // minutes
    enabledSites: ['welcometothejungle', 'linkedin', 'indeed'],
    lastChecked: {},
    savedJobs: [],
    seenJobIds: [] // Track jobs we've already notified about
  });

  // Create periodic alarm for checking jobs
  chrome.alarms.create('checkJobs', {
    periodInMinutes: 30
  });

  // Show welcome notification
  chrome.notifications.create('welcome', {
    type: 'basic',
    iconUrl: '../assets/icon.png',
    title: '🎉 Job Alert Notifier Installed!',
    message: 'Click the extension icon to configure your job preferences.',
    priority: 2
  });
});

// Listen to alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkJobs') {
    console.log('⏰ Alarm triggered - checking for jobs...');
    checkForNewJobs();
  }
});

// Main function to check for new jobs - DYNAMIC VERSION
async function checkForNewJobs() {
  console.log('🔍 Starting job search...');
  
  const settings = await chrome.storage.sync.get([
    'keywords',
    'enabledSites',
    'savedJobs',
    'seenJobIds'
  ]);

  const { keywords, enabledSites, savedJobs, seenJobIds = [] } = settings;

  if (!keywords || keywords.length === 0) {
    console.log('⚠️ No keywords configured');
    return;
  }

  console.log('🎯 Searching for:', keywords);
  console.log('🌐 On sites:', enabledSites);

  let allNewJobs = [];

  // Scrape each enabled site
  for (const site of enabledSites) {
    try {
      const jobs = await scrapeJobSite(site, keywords);
      console.log(`✅ Found ${jobs.length} jobs on ${site}`);
      allNewJobs.push(...jobs);
    } catch (error) {
      console.error(`❌ Error scraping ${site}:`, error);
    }
  }

  // Filter out jobs we've already seen
  const unseenJobs = allNewJobs.filter(job => !seenJobIds.includes(job.id));

  console.log(`🆕 ${unseenJobs.length} new jobs found!`);

  if (unseenJobs.length > 0) {
    // Send notification for EACH new job
    for (const job of unseenJobs) {
      await sendJobNotification(job);
      // Small delay between notifications to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Update saved jobs and seen IDs
    const updatedJobs = [...savedJobs, ...unseenJobs];
    const updatedSeenIds = [...seenJobIds, ...unseenJobs.map(j => j.id)];
    
    await chrome.storage.sync.set({ 
      savedJobs: updatedJobs,
      seenJobIds: updatedSeenIds,
      lastChecked: { [Date.now()]: unseenJobs.length }
    });

    console.log('💾 Saved new jobs to storage');
  } else {
    console.log('😴 No new jobs this time');
    // Update last checked time
    await chrome.storage.sync.set({ 
      lastChecked: { [Date.now()]: 0 }
    });
  }
}

// Send individual job notification with full details
async function sendJobNotification(job) {
  const notificationId = `job_${job.id}`;
  
  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: '../assets/icon.png',
    title: `🎯 New Job Alert!`,
    message: `${job.title}\n${job.company} - ${job.location}\n${job.salary || 'Salary not specified'}`,
    priority: 2,
    requireInteraction: true, // Notification stays until user interacts
    buttons: [
      { title: '👀 View Job' },
      { title: '💾 Save for Later' }
    ]
  });

  console.log(`📬 Notification sent for: ${job.title}`);
}

// DYNAMIC SCRAPING FUNCTION - Queries actual job sites
async function scrapeJobSite(site, keywords) {
  const jobs = [];
  
  try {
    // Create search query from keywords
    const query = keywords.join(' OR ');
    
    switch (site) {
      case 'welcometothejungle':
        const wttjJobs = await scrapeWelcomeToTheJungle(keywords);
        jobs.push(...wttjJobs);
        break;
        
      case 'linkedin':
        const linkedInJobs = await scrapeLinkedIn(keywords);
        jobs.push(...linkedInJobs);
        break;
        
      case 'indeed':
        const indeedJobs = await scrapeIndeed(keywords);
        jobs.push(...indeedJobs);
        break;
    }
  } catch (error) {
    console.error(`Error scraping ${site}:`, error);
  }
  
  return jobs;
}

// Scrape Welcome to the Jungle
async function scrapeWelcomeToTheJungle(keywords) {
  const jobs = [];
  const query = keywords[0]; // Use first keyword for search
  
  try {
    // Query the actual Welcome to the Jungle jobs page
    const tabs = await chrome.tabs.query({});
    
    // Check if we already have a WTTJ tab open
    let wttjTab = tabs.find(tab => tab.url && tab.url.includes('welcometothejungle.com'));
    
    if (!wttjTab) {
      // Open new tab in background
      wttjTab = await chrome.tabs.create({
        url: `https://www.welcometothejungle.com/en/jobs?query=${encodeURIComponent(query)}`,
        active: false
      });
      
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Inject and execute content script to scrape
    const results = await chrome.scripting.executeScript({
      target: { tabId: wttjTab.id },
      func: extractWTTJJobs
    });
    
    if (results && results[0] && results[0].result) {
      jobs.push(...results[0].result);
    }
    
  } catch (error) {
    console.error('Error scraping WTTJ:', error);
  }
  
  return jobs;
}

// Function injected into page to extract jobs
function extractWTTJJobs() {
  const jobs = [];
  
  // Try multiple selectors as sites update their HTML
  const selectors = [
    '[data-testid="job-card"]',
    '.job-card',
    '[class*="JobCard"]',
    'article[data-testid*="job"]'
  ];
  
  let jobCards = [];
  for (const selector of selectors) {
    jobCards = document.querySelectorAll(selector);
    if (jobCards.length > 0) break;
  }
  
  console.log(`Found ${jobCards.length} job cards`);
  
  jobCards.forEach((card, index) => {
    try {
      // Try multiple selectors for each field
      const titleElement = card.querySelector('h3, h2, [data-testid*="title"], .job-title, [class*="Title"]');
      const companyElement = card.querySelector('[data-testid*="company"], .company-name, [class*="Company"]');
      const locationElement = card.querySelector('[data-testid*="location"], .location, [class*="Location"]');
      const linkElement = card.querySelector('a[href*="/jobs/"]');
      
      if (titleElement && linkElement) {
        const jobUrl = linkElement.href.startsWith('http') 
          ? linkElement.href 
          : `https://www.welcometothejungle.com${linkElement.href}`;
          
        jobs.push({
          id: `wttj_${btoa(jobUrl).substring(0, 20)}_${Date.now()}_${index}`,
          title: titleElement.textContent.trim(),
          company: companyElement ? companyElement.textContent.trim() : 'Company not found',
          location: locationElement ? locationElement.textContent.trim() : 'Location not specified',
          url: jobUrl,
          site: 'welcometothejungle',
          postedDate: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error extracting job:', error);
    }
  });
  
  return jobs;
}

// Scrape LinkedIn (similar pattern)
async function scrapeLinkedIn(keywords) {
  const jobs = [];
  const query = keywords.join(' ');
  
  try {
    const tabs = await chrome.tabs.query({});
    let linkedInTab = tabs.find(tab => tab.url && tab.url.includes('linkedin.com/jobs'));
    
    if (!linkedInTab) {
      linkedInTab = await chrome.tabs.create({
        url: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}`,
        active: false
      });
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: linkedInTab.id },
      func: extractLinkedInJobs
    });
    
    if (results && results[0] && results[0].result) {
      jobs.push(...results[0].result);
    }
    
  } catch (error) {
    console.error('Error scraping LinkedIn:', error);
  }
  
  return jobs;
}

function extractLinkedInJobs() {
  const jobs = [];
  
  const selectors = [
    '.job-card-container',
    '.jobs-search-results__list-item',
    '[data-job-id]',
    '.job-search-card'
  ];
  
  let jobCards = [];
  for (const selector of selectors) {
    jobCards = document.querySelectorAll(selector);
    if (jobCards.length > 0) break;
  }
  
  jobCards.forEach((card, index) => {
    try {
      const titleElement = card.querySelector('.job-card-list__title, h3, [class*="job-title"]');
      const companyElement = card.querySelector('.job-card-container__company-name, [class*="company"]');
      const locationElement = card.querySelector('.job-card-container__metadata-item, [class*="location"]');
      const linkElement = card.querySelector('a');
      
      if (titleElement && linkElement) {
        jobs.push({
          id: `linkedin_${btoa(linkElement.href).substring(0, 20)}_${Date.now()}_${index}`,
          title: titleElement.textContent.trim(),
          company: companyElement ? companyElement.textContent.trim() : 'Company not found',
          location: locationElement ? locationElement.textContent.trim() : 'Location not specified',
          url: linkElement.href,
          site: 'linkedin',
          postedDate: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error extracting LinkedIn job:', error);
    }
  });
  
  return jobs;
}

// Scrape Indeed
async function scrapeIndeed(keywords) {
  const jobs = [];
  const query = keywords.join(' ');
  
  try {
    const tabs = await chrome.tabs.query({});
    let indeedTab = tabs.find(tab => tab.url && tab.url.includes('indeed.com'));
    
    if (!indeedTab) {
      indeedTab = await chrome.tabs.create({
        url: `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}`,
        active: false
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: indeedTab.id },
      func: extractIndeedJobs
    });
    
    if (results && results[0] && results[0].result) {
      jobs.push(...results[0].result);
    }
    
  } catch (error) {
    console.error('Error scraping Indeed:', error);
  }
  
  return jobs;
}

function extractIndeedJobs() {
  const jobs = [];
  
  const jobCards = document.querySelectorAll('.job_seen_beacon, .jobsearch-SerpJobCard, [data-jk]');
  
  jobCards.forEach((card, index) => {
    try {
      const titleElement = card.querySelector('h2 a, .jobTitle, [class*="jobTitle"]');
      const companyElement = card.querySelector('.companyName, [class*="company"]');
      const locationElement = card.querySelector('.companyLocation, [class*="location"]');
      const salaryElement = card.querySelector('.salary-snippet, [class*="salary"]');
      
      if (titleElement) {
        const jobUrl = titleElement.href || titleElement.closest('a')?.href;
        
        jobs.push({
          id: `indeed_${btoa(jobUrl || '').substring(0, 20)}_${Date.now()}_${index}`,
          title: titleElement.textContent.trim(),
          company: companyElement ? companyElement.textContent.trim() : 'Company not found',
          location: locationElement ? locationElement.textContent.trim() : 'Location not specified',
          salary: salaryElement ? salaryElement.textContent.trim() : null,
          url: jobUrl || `https://www.indeed.com`,
          site: 'indeed',
          postedDate: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error extracting Indeed job:', error);
    }
  });
  
  return jobs;
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // View Job button
    chrome.storage.sync.get('savedJobs', (data) => {
      const job = data.savedJobs.find(j => notificationId.includes(j.id));
      if (job) {
        chrome.tabs.create({ url: job.url });
      }
    });
  } else if (buttonIndex === 1) {
    // Already saved, just acknowledge
    console.log('Job saved for later');
  }
  chrome.notifications.clear(notificationId);
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.storage.sync.get('savedJobs', (data) => {
    const job = data.savedJobs.find(j => notificationId.includes(j.id));
    if (job) {
      chrome.tabs.create({ url: job.url });
    }
  });
  chrome.notifications.clear(notificationId);
});

// Listen to messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkNow') {
    console.log('🔄 Manual check requested');
    checkForNewJobs().then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      console.error('Error during manual check:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'updateSettings') {
    chrome.storage.sync.set(request.settings, () => {
      if (request.settings.checkInterval) {
        chrome.alarms.clear('checkJobs', () => {
          chrome.alarms.create('checkJobs', {
            periodInMinutes: request.settings.checkInterval
          });
          console.log(`⏰ Alarm updated: check every ${request.settings.checkInterval} minutes`);
        });
      }
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'testNotification') {
    sendJobNotification({
      id: 'test_' + Date.now(),
      title: 'Test Job Notification',
      company: 'Test Company',
      location: 'Test Location',
      salary: '50k-70k EUR',
      url: 'https://example.com'
    });
    sendResponse({ success: true });
    return true;
  }
});