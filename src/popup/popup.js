// popup.js
document.getElementById('refreshJobs').addEventListener('click', function() {
  // Fetch latest jobs (this could be from localStorage or background script)
  chrome.runtime.sendMessage({ action: 'getJobListings' }, (response) => {
    const jobContainer = document.getElementById('jobListings');
    jobContainer.innerHTML = '';
    response.jobListings.forEach(job => {
      const jobElement = document.createElement('div');
      jobElement.textContent = `${job.title} at ${job.company}`;
      jobContainer.appendChild(jobElement);
    });
  });
});
