# Job Explorer — Chrome Extension (Manifest V3)

Job Explorer ranks job listings visible on the current page against your skills, target role, location, and optional text resume.

## Features
- Chrome Extension Manifest V3.
- Profile fields for skills, experience, target roles, and preferred location.
- TXT resume text import; PDF/DOCX upload UI with an honest notice that parsing is not included in this starter build.
- Scans job-card-like elements in the currently open page and scores detected listings.
- Shows keyword match percentage, matched terms, vacancy links, and CSV export.
- Uses local Chrome storage. Resume/profile data is not sent to a server.

## Install in Chrome
1. Extract the `Job Explorer.zip` file.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted `Job Explorer` folder (the folder containing `manifest.json`).
6. Open a job-search/results page, sign in normally if required, and scroll to load listings.
7. Click the Job Explorer icon, enter your profile, then click **Scan current page**.

## Important limitations
- This is a client-side starter extension, not a universal crawler. Job sites use different page structures, lazy loading, anti-bot controls, and terms of service. The generic selectors may miss listings or mistake page elements for vacancies.
- It scans the currently loaded page only. It does not automatically crawl every page or access hidden listings, private APIs, CAPTCHA-protected content, or login-restricted data.
- Resume parsing currently supports `.txt` only. PDF and DOCX are accepted by the upload picker but not parsed; convert to TXT or manually enter skills.
- Match percentages are heuristic keyword scores, not calibrated probabilities or a guarantee of fit.
- No automated applications, credential collection, or server upload is included.

## Project files
- `manifest.json`: extension configuration
- `popup.html`, `popup.css`, `popup.js`: user interface and ranking
- `content.js`: extracts visible listing-like content from the active page
- `background.js`: persists scan results
- `README.md`: installation and limitations

## Suggested production improvements
1. Add a local PDF/DOCX parser library and clear file-size limits.
2. Build and test dedicated adapters for each supported site, respecting its terms and robots/automation policies.
3. Add deduplication, pagination controls, filters, and a better match model that considers required vs. preferred skills, seniority, salary, and location.
4. Add automated tests with saved HTML fixtures for each supported site.
5. Minimize permissions to specific supported domains before publishing.
