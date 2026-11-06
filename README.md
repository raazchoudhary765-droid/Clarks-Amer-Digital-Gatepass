# Hotel Clarks Amer Jaipur – Desktop-first Digital Gatepass

This is the complete GitHub Pages frontend and matching Google Apps Script backend.

## Files
- `index.html` – app page
- `style.css` – Royal Navy / Gold desktop-first responsive design
- `app.js` – frontend API integration (your supplied `/exec` URL is already set)
- `Clarks Amer logo` – embedded directly inside index.html, so no separate logo path is needed
- `Code.gs` – backend configured for your existing Google Spreadsheet ID
- `.nojekyll` – GitHub Pages helper

## Existing services configured
Google Apps Script Web App URL:
`https://script.google.com/macros/s/AKfycbw7Qo_X8si9iDurJqbv9iV2MdMRFfGHHupek2T6xE979I4KfxZRFD2p6RqJMO2vYjA-/exec`

Google Spreadsheet:
`https://docs.google.com/spreadsheets/d/17meWZkE0tydmCiWS5YhfGeCnVE4flgsfzgbJStMi-D4/edit`

## GitHub upload (desktop computer)
1. Extract this ZIP on your computer.
2. Open your repository: `Clarks-Amer-Digital-Gatepass`.
3. Click **Add file > Upload files**.
4. Upload `index.html`, `style.css`, `app.js`, `.nojekyll`, and optionally `README.md`. The logo is embedded inside index.html. Keep Code.gs in Apps Script only.
5. Click **Commit changes**.
6. Open repository **Settings > Pages**.
7. Under Build and deployment choose **Deploy from a branch**.
8. Branch: `main`; Folder: `/ (root)`; click Save.
9. Wait for GitHub Pages to publish. Open the Pages URL on your computer and press `Ctrl + F5`.

## Apps Script backend update (required)
The `/exec` URL is already inserted in `app.js`, but the Apps Script endpoint must run the matching backend:
1. Open the Apps Script project associated with the supplied `/exec` deployment.
2. Replace the full `Code.gs` with the `Code.gs` in this ZIP. This version returns Google Drive thumbnail URLs and upgrades older stored Drive links when listing records.
3. Save.
4. Run `diagnoseExistingSpreadsheet()` and check the Execution log.
5. Run `setupExistingSpreadsheet()` once. It targets the existing spreadsheet ID and does not create a new spreadsheet.
6. Deploy > Manage deployments > Edit > New version > Deploy.

## Login
If the `USERS` tab is empty except for its header, setup creates:
- Management: `admin` / `ChangeMe@123`
- Security: `guard01` / `Guard@123`

If `USERS` already contains users, setup preserves them and does not overwrite their passwords.

## Features
- Manual Gatepass No. entry; duplicate number rejected
- Gatepass date, Vehicle / By Hand, person name and remarks
- Multiple photo attachments (8 MB maximum per photo)
- Photos saved to Drive and linked in Sheets
- Separate Security and Management data views
- Management sees all records; Security sees records submitted by their own username
- Dashboard KPIs, search and date/movement filters
- Click an image to open the zoom viewer
- Google Sheet shortcut
- Royal desktop-first layout, also adapts to smaller screens

## Important
- This is a desktop-optimized web application for Chrome/Edge via GitHub Pages. It is not a compiled Windows `.exe` installer.
- Uploaded photos are currently shared as "Anyone with the link – Viewer" to allow browser previews. Anyone obtaining a photo URL may view it. Confirm hotel IT/privacy policy before using sensitive records.
- Test the deployed app with a non-sensitive sample record first.
