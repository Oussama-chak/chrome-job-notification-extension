// Content script - Enhances WTTJ pages
console.log('🎯 WTTJ Job Alert: Content script loaded');

// Highlight matching jobs on the page
async function highlightMatchingJobs() {
  const settings = await chrome.storage.sync.get('keywords');
  const keywords = settings.keywords || [];
  
  if (keywords.length === 0) return;

  // Find job cards on page
  const selectors = [
    'article[data-testid*="job"]',
    '[data-testid="search-result-item"]',
    '.job-card',
    'h3, h2'
  ];
  
  let jobElements = [];
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      jobElements = Array.from(elements);
      break;
    }
  }

  jobElements.forEach((element) => {
    const text = element.textContent.toLowerCase();
    const matches = keywords.some(keyword => 
      text.includes(keyword.toLowerCase())
    );
    
    if (matches && !element.hasAttribute('data-wttj-highlighted')) {
      element.style.borderLeft = '5px solid #00b894';
      element.style.backgroundColor = '#e8f8f5';
      element.style.paddingLeft = '12px';
      element.setAttribute('data-wttj-highlighted', 'true');
      
      // Add badge
      const badge = document.createElement('span');
      badge.textContent = '✓ Match';
      badge.style.cssText = `
        background: #00b894;
        color: white;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: bold;
        margin-left: 10px;
        display: inline-block;
      `;
      
      const titleElement = element.querySelector('h3, h2');
      if (titleElement && !titleElement.querySelector('span[data-badge]')) {
        badge.setAttribute('data-badge', 'true');
        titleElement.appendChild(badge);
      }
    }
  });
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', highlightMatchingJobs);
} else {
  highlightMatchingJobs();
}

// Re-run when content changes (for infinite scroll)
const observer = new MutationObserver(() => {
  highlightMatchingJobs();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});