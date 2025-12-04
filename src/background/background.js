// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log("Job Notification Extension Installed");

  // Add initial setup logic or defaults if needed
});

chrome.alarms.create('jobScraper', {
  periodInMinutes: 30  // Set how often you want to check for new jobs (every 30 minutes in this case)
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'jobScraper') {
    // Call function to scrape jobs from Indeed
    scrapeJobs();
  }
});

function scrapeJobs() {
  // Logic to scrape Indeed or your data source for new job listings
  console.log('Scraping new job listings...');
  
  // Example: Trigger notification if a new job is found
  chrome.notifications.create('jobNotification', {
    type: 'basic',
    iconUrl: 'assets/icon.png',
    title: 'New Job Offer!',
    message: 'A new job offer matching your skills has been posted.',
    priority: 2
  });
}
