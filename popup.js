const $ = (id) => document.getElementById(id);
let currentResults = [];

async function readProfile() {
  const data = await chrome.storage.local.get(["profile", "lastScan", "lastScanUrl"]);
  const p = data.profile || {};
  $("skills").value = p.skills || "";
  $("experience").value = p.experience || "";
  $("role").value = p.role || "";
  $("location").value = p.location || "";
  if (data.lastScan?.length) {
    $("status").textContent = `Last scan: ${data.lastScan.length} listings from ${data.lastScanUrl || "current page"}`;
  }
  renderResults(data.lastScan || [], p);
}
async function saveProfile() {
  const profile = {
    skills: $("skills").value.trim(),
    experience: $("experience").value.trim(),
    role: $("role").value.trim(),
    location: $("location").value.trim(),
    resumeText: ""
  };
  await chrome.storage.local.set({ profile });
  $("status").textContent = "Profile saved on this browser.";
  return profile;
}
function tokenize(s) {
  return [...new Set((s || "").toLowerCase().match(/[a-z0-9+#.-]{2,}/g) || [])]
    .filter(x => !["and","the","with","for","from","you","your","our","job","jobs","work","years","year","experience","required","preferred"].includes(x));
}
function rank(job, profile) {
  const skills = tokenize(profile.skills);
  const roleTerms = tokenize(profile.role);
  const resumeTerms = tokenize(profile.resumeText);
  const text = (job.title + " " + job.description + " " + job.company + " " + job.location).toLowerCase();
  let hits = [], score = 0;
  for (const term of skills) {
    if (text.includes(term)) { score += 5; hits.push(term); }
  }
  for (const term of roleTerms) {
    if (text.includes(term)) { score += 7; if (!hits.includes(term)) hits.push(term); }
  }
  // Resume terms add a modest bonus; generic terms are down-weighted by using only distinct tokens.
  let resumeHits = 0;
  for (const term of resumeTerms.slice(0, 100)) {
    if (text.includes(term)) resumeHits++;
  }
  score += Math.min(20, resumeHits);
  if (profile.location && text.includes(profile.location.toLowerCase())) score += 8;
  const exp = (profile.experience || "").match(/\d+/)?.[0];
  if (exp && text.includes(exp)) score += 2;
  const denominator = Math.max(1, skills.length * 5 + roleTerms.length * 7);
  const pct = Math.max(0, Math.min(99, Math.round((score / denominator) * 100)));
  return { score, pct, hits: hits.slice(0, 12), resumeHits };
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function renderResults(jobs, profile = {}) {
  currentResults = jobs.map(job => ({ ...job, match: rank(job, profile) }))
    .sort((a,b) => b.match.score - a.match.score);
  $("count").textContent = String(currentResults.length);
  $("export").disabled = currentResults.length === 0;
  if (!currentResults.length) {
    $("results").innerHTML = '<p class="muted">No listings detected. Try a job search/results page and scroll to load listings before scanning.</p>';
    return;
  }
  $("results").innerHTML = currentResults.slice(0, 35).map((j, i) => `
    <div class="job">
      <h3>${i + 1}. ${escapeHtml(j.title)}</h3>
      <div class="meta">${escapeHtml(j.company || j.source)}${j.location ? " · " + escapeHtml(j.location) : ""}</div>
      <div class="score">${j.match.pct}% profile keyword match</div>
      <div class="why">${j.match.hits.length ? "Matched: " + escapeHtml(j.match.hits.join(", ")) : "Few direct skill/role keyword matches detected."}</div>
      ${j.url ? `<div><a href="${escapeHtml(j.url)}" target="_blank" rel="noreferrer">Open vacancy ↗</a></div>` : ""}
    </div>`).join("");
}
async function scanCurrentPage() {
  $("status").textContent = "Scanning visible listings…";
  const profile = await saveProfile();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url || "")) {
    $("status").textContent = "Open a normal job website page, then scan again.";
    return;
  }
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "JOB_EXPLORER_SCAN" });
    if (!response?.ok) throw new Error(response?.error || "Could not scan this page.");
    const jobs = response.jobs || [];
    await chrome.storage.local.set({ lastScan: jobs, lastScanUrl: response.url || tab.url });
    renderResults(jobs, profile);
    $("status").textContent = `Scanned ${jobs.length} possible listings.`;
  } catch (err) {
    // Some restricted pages don't allow content scripts. Try an explicit injection.
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      const response = await chrome.tabs.sendMessage(tab.id, { type: "JOB_EXPLORER_SCAN" });
      if (!response?.ok) throw new Error(response?.error || "Scan failed.");
      await chrome.storage.local.set({ lastScan: response.jobs || [], lastScanUrl: response.url || tab.url });
      renderResults(response.jobs || [], profile);
      $("status").textContent = `Scanned ${(response.jobs || []).length} possible listings.`;
    } catch (e) {
      $("status").textContent = "Could not scan this page. Refresh the page, then try again. Some sites restrict extensions on their pages.";
    }
  }
}
function exportCsv() {
  const rows = [["Title","Company","Location","Match %","Matched terms","URL","Source","Description"]];
  currentResults.forEach(j => rows.push([
    j.title, j.company, j.location, j.match.pct, j.match.hits.join("; "), j.url, j.source, j.description
  ]));
  const csv = rows.map(row => row.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename: "job-explorer-results.csv", saveAs: true }, () => {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
}
$("saveProfile").addEventListener("click", saveProfile);
$("scanPage").addEventListener("click", scanCurrentPage);
$("export").addEventListener("click", exportCsv);
$("resumeFile").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  $("fileStatus").textContent = `Selected: ${file.name}.`;
  // TXT can be extracted directly. PDF extraction is deliberately not guessed without a PDF parser.
  if (file.name.toLowerCase().endsWith(".txt")) {
    const text = await file.text();
    const data = await chrome.storage.local.get("profile");
    const profile = { ...(data.profile || {}), resumeText: text.slice(0, 100000) };
    await chrome.storage.local.set({ profile });
    $("fileStatus").textContent = `Read text from ${file.name}. Save profile to update other fields.`;
  } else if (file.name.toLowerCase().endsWith(".pdf")) {
    $("fileStatus").textContent = "PDF selected. This starter build does not bundle a PDF parser; paste key skills into the Skills field or use a TXT version of your resume.";
  } else {
    $("fileStatus").textContent = "DOCX selected. This starter build does not parse DOCX locally; paste key skills into the Skills field or save resume text as TXT.";
  }
});
readProfile();