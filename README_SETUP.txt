HOTEL CLARKS AMER — SECURITY RGP / NRGP GATE PASS

LIVE APP (Google Sheets + Google Drive):
1. Create a NEW Google Spreadsheet (or BACK UP your existing sheet first).
2. Extensions > Apps Script. Paste Code.gs into Code.gs.
3. Add an HTML file named Index; paste Index.html.
4. Add an HTML file named Style; paste Style.html.
5. Add an HTML file named Logo; paste Logo.html. This embeds the supplied Clarks Amer logo.
6. Run setupSheets() once and grant Google permissions.
7. Deploy > New Deployment > Web app. Execute as Me; access limited to approved hotel users, never anonymous/public for live security records.
8. Open the deployed /exec URL. It is the LIVE app. Photos go to a private Drive folder; sheets are auto-created and headers auto-corrected.
9. Test with a dummy RGP (pending, partial return, full return closed) and NRGP (closed on save).

GITHUB:
- index.html, style.css and assets/logo.png can be uploaded to GitHub.
- GitHub Pages version runs LOCAL DEMO only. It cannot directly call google.script.run from GitHub Pages.
- For real Google Sheet/Drive save, use the Apps Script deployed URL as the operational app.
- You may place the Apps Script deployment link in your GitHub README or create a redirect to the deployed app.

SHEET HEADERS:
- GATEPASS_MASTER (24 columns)
- RETURN_LOG (8 columns)
- AUDIT_LOG (6 columns)
Code.gs automatically creates/corrects these. If existing legacy columns are incompatible, they are backed up in BACKUP_<TABNAME> before migration; verify migrated rows before using live.

WORKFLOW:
- Security selects gatepass image, then chooses RGP or NRGP.
- NRGP saved as Closed immediately.
- RGP saved as Pending, remains Pending on partial receipt, changes to Closed only when full quantity received.
- Material receipt is recorded in RETURN_LOG with date/time, received by, quantity, remarks.
- PDF uses Hotel Clarks Amer branded A4 printable layout and attached photos.

SECURITY:
- Drive photos are private; access must be controlled by hotel Google account permissions.
- This starter does not provide individual role-based authorization or verified approvals. For production, restrict deployment access and add approved identity/role controls.
- Apps Script may reject very large payloads; image files are resized in browser. Upload maximum four supporting images.
