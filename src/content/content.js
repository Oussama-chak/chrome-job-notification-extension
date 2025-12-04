// content.js
const jobListings = [];

// Scrape job title and company from Indeed job listing
const jobElements = document.querySelectorAll('.job_seen_beacon');
jobElements.forEach(jobElement => {
  const title = jobElement.querySelector('.jobTitle a').innerText;
  const company = jobElement.querySelector('.companyName').innerText;
  jobListings.push({ title, company });
});

console.log(jobListings);  // You can use this data for further processing

// Optionally, send the data back to background.js to trigger notifications
chrome.runtime.sendMessage({ jobListings });
