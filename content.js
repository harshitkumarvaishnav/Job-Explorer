(() => {
  // Avoid injecting the scanner more than once in a page.
  if (window.__jobExplorerLoaded) return;
  window.__jobExplorerLoaded = true;

  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const badText = /^(jobs|view job|apply now|easy apply|save job|share|see more|show more|next|previous)$/i;
  const titleSelectors = [
    '[data-testid*="job-title"]', '[data-test*="job-title"]',
    '.jobTitle', '.job-title', '.job-title-link', 'h2 a', 'h3 a',
    'a[href*="/job/"]', 'a[href*="/jobs/"]', 'a[href*="jobId="]',
    'a[href*="jk="]', 'a[href*="/viewjob"]'
  ];
  function findCard(el) {
    let n = el;
    for (let i = 0; i < 6 && n && n !== document.body; i++, n = n.parentElement) {
      const t = clean(n.innerText);
      if (t.length > 80 && t.length < 5000 && /(apply|posted|salary|experience|full.time|part.time|remote|location)/i.test(t)) return n;
    }
    return el.closest("article, li, [role='listitem']") || el.parentElement;
  }
  function scan() {
    const found = new Map();
    for (const selector of titleSelectors) {
      document.querySelectorAll(selector).forEach(el => {
        const title = clean(el.innerText || el.getAttribute("aria-label") || el.getAttribute("title"));
        if (!title || title.length < 3 || title.length > 180 || badText.test(title)) return;
        const href = el.href || el.closest("a")?.href || "";
        const card = findCard(el);
        const description = clean(card?.innerText || title);
        if (description.length < 35) return;
        const key = (href || title) + "|" + description.slice(0, 80);
        if (!found.has(key)) found.set(key, {
          title, company: "", location: "", description: description.slice(0, 3500),
          url: href, source: location.hostname
        });
      });
    }
    // Some sites use cards without standard title classes. Use heading anchors as fallback.
    document.querySelectorAll("article h2, article h3, li h2, li h3, [role='listitem'] h2, [role='listitem'] h3").forEach(el => {
      const a = el.querySelector("a") || el.closest("a");
      const title = clean(a?.innerText || el.innerText);
      if (!title || title.length < 3 || title.length > 180 || badText.test(title)) return;
      const card = findCard(el);
      const description = clean(card?.innerText || title);
      const href = a?.href || "";
      const key = (href || title) + "|" + description.slice(0, 80);
      if (!found.has(key) && description.length > 35) found.set(key, {
        title, company: "", location: "", description: description.slice(0, 3500),
        url: href, source: location.hostname
      });
    });
    const jobs = [...found.values()].slice(0, 250).map(job => {
      const lines = job.description.split(/(?<=[.!?])\s+|\n/).map(clean).filter(Boolean);
      job.company = lines.find(x => /company|employer/i.test(x))?.replace(/^(company|employer)\s*:?/i, "") || "";
      job.location = lines.find(x => /(location|remote|hybrid|onsite|on-site|india|delhi|mumbai|bangalore|bengaluru|gurugram|noida)/i.test(x))?.slice(0, 100) || "";
      return job;
    });
    chrome.runtime.sendMessage({
      type: "JOB_EXPLORER_SCAN_RESULT", jobs, url: location.href
    }, () => void chrome.runtime.lastError);
    return jobs;
  }
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "JOB_EXPLORER_SCAN") {
      try { sendResponse({ ok: true, jobs: scan(), url: location.href }); }
      catch (e) { sendResponse({ ok: false, error: String(e) }); }
    }
    return true;
  });
})();