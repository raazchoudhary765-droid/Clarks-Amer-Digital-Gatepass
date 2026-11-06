/**
 * HOTEL CLARKS AMER JAIPUR – DIGITAL GATEPASS BACKEND
 * Integrated with the user's EXISTING Google Spreadsheet.
 *
 * Existing Spreadsheet ID:
 * 17meWZkE0tydmCiWS5YhfGeCnVE4flgsfzgbJStMi-D4
 *
 * Existing deployed Web App URL:
 * https://script.google.com/macros/s/AKfycbw7Qo_X8si9iDurJqbv9iV2MdMRFfGHHupek2T6xE979I4KfxZRFD2p6RqJMO2vYjA-/exec
 *
 * IMPORTANT:
 * - Paste this complete file into the Apps Script PROJECT that owns the deployed URL above.
 * - Run setupExistingSpreadsheet() once.
 * - Deploy > Manage deployments > Edit (pencil) > New version > Deploy.
 *
 * Required sheet tabs / exact names:
 * GATEPASS_RECORDS, GATEPASS_PHOTOS, USERS
 */

const CONFIG = {
  SPREADSHEET_ID: '17meWZkE0tydmCiWS5YhfGeCnVE4flgsfzgbJStMi-D4',
  PHOTO_FOLDER_NAME: 'Clarks Amer Gatepass Photos',
  SHEETS: {
    GATEPASSES: 'GATEPASS_RECORDS',
    PHOTOS: 'GATEPASS_PHOTOS',
    USERS: 'USERS'
  },
  SESSION_SECONDS: 21600,
  MAX_FILE_BYTES: 8 * 1024 * 1024,
  // Required for browser photo previews. Anyone with a photo link may view it.
  SHARE_PHOTOS_WITH_LINK: true,
  HEADERS: {
    GATEPASSES: [
      'Gatepass No.', 'Gatepass Date', 'Movement Type', 'Vehicle Number',
      'Person Name', 'Remarks', 'Photo Count', 'Photo URLs', 'Photo File IDs',
      'Submitted By', 'Submitted At', 'Status'
    ],
    PHOTOS: [
      'Gatepass No.', 'Photo No.', 'File Name', 'Drive File ID',
      'Photo URL', 'Uploaded By', 'Uploaded At'
    ],
    USERS: ['Username', 'Display Name', 'Role', 'Salt', 'Password Hash', 'Active']
  }
};

/** Run once after pasting this code. It uses the EXISTING spreadsheet; it does not create a new spreadsheet. */
function setupExistingSpreadsheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ensureSheetAndHeaders_(ss, CONFIG.SHEETS.GATEPASSES, CONFIG.HEADERS.GATEPASSES);
  ensureSheetAndHeaders_(ss, CONFIG.SHEETS.PHOTOS, CONFIG.HEADERS.PHOTOS);
  const users = ensureSheetAndHeaders_(ss, CONFIG.SHEETS.USERS, CONFIG.HEADERS.USERS);

  // Create starter accounts only when USERS has headers and no user records.
  // Change these passwords immediately after first login.
  if (users.getLastRow() < 2) {
    addUser_('admin', 'Management Admin', 'MANAGEMENT', 'ChangeMe@123');
    addUser_('guard01', 'Security Guard 01', 'SECURITY', 'Guard@123');
  }

  const props = PropertiesService.getScriptProperties();
  props.setProperty('SPREADSHEET_ID', CONFIG.SPREADSHEET_ID);

  let folderId = props.getProperty('PHOTO_FOLDER_ID');
  let folder = null;
  if (folderId) {
    try { folder = DriveApp.getFolderById(folderId); folder.getName(); } catch (e) { folder = null; }
  }
  if (!folder) {
    folder = DriveApp.createFolder(CONFIG.PHOTO_FOLDER_NAME);
    props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  }

  [CONFIG.SHEETS.GATEPASSES, CONFIG.SHEETS.PHOTOS, CONFIG.SHEETS.USERS].forEach(name => {
    const sh = ss.getSheetByName(name);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn())
      .setFontWeight('bold').setBackground('#17283E').setFontColor('#FFFFFF');
    sh.autoResizeColumns(1, sh.getLastColumn());
  });

  const report = {
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    sheetTabs: ss.getSheets().map(s => s.getName()),
    photoFolderUrl: folder.getUrl(),
    initialAccountsCreated: users.getLastRow() === 3
  };
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

/** Simple GET health check. */
function doGet() {
  return json_({
    ok: true,
    app: 'Clarks Amer Digital Gatepass API',
    version: '2.0-existing-sheet',
    spreadsheetUrl: getSpreadsheet_().getUrl(),
    message: 'API is running'
  });
}

/** API endpoint consumed by the existing GitHub frontend. */
function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const body = JSON.parse(raw);
    const action = String(body.action || '');
    let result;

    if (action === 'login') {
      result = login_(body);
    } else {
      const user = authenticate_(body.token);
      if (action === 'createGatepass') {
        result = createGatepass_(body, user);
      } else if (action === 'listGatepasses') {
        result = listGatepasses_(body, user);
      } else if (action === 'logout') {
        CacheService.getScriptCache().remove('sess_' + body.token);
        result = { ok: true };
      } else {
        throw new Error('Unknown action: ' + action);
      }
    }
    return json_(result);
  } catch (err) {
    return json_({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

/* ------------------------------ LOGIN ------------------------------ */

function login_(body) {
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!username || !password) throw new Error('Username and password are required');

  const sh = getSheet_(CONFIG.SHEETS.USERS);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row[0]).trim().toLowerCase() !== username) continue;
    if (String(row[5]).toUpperCase() !== 'TRUE') throw new Error('This account is inactive');
    if (hashPassword_(password, String(row[3])) !== String(row[4])) {
      throw new Error('Invalid username or password');
    }

    const token = Utilities.getUuid() + Utilities.getUuid();
    const user = {
      username: String(row[0]),
      name: String(row[1]),
      role: String(row[2]).toUpperCase()
    };
    if (!['SECURITY', 'MANAGEMENT'].includes(user.role)) throw new Error('Invalid user role');
    CacheService.getScriptCache().put('sess_' + token, JSON.stringify(user), CONFIG.SESSION_SECONDS);
    return { ok: true, token: token, user: user };
  }
  throw new Error('Invalid username or password');
}

function authenticate_(token) {
  if (!token) throw new Error('Please login again');
  const cached = CacheService.getScriptCache().get('sess_' + token);
  if (!cached) throw new Error('Session expired. Please login again');
  return JSON.parse(cached);
}

/* --------------------------- CREATE RECORD -------------------------- */

function createGatepass_(body, user) {
  if (!['SECURITY', 'MANAGEMENT'].includes(user.role)) throw new Error('Not authorized');

  const gatepassNo = String(body.gatepassNo || '').trim();
  const personName = String(body.personName || '').trim();
  const movementType = String(body.movementType || '').trim().toUpperCase();
  const vehicleNumber = String(body.vehicleNumber || '').trim().toUpperCase();
  const remarks = String(body.remarks || '').trim();
  const dateInput = String(body.gatepassDate || '').trim();

  // Manual Gatepass Number – never auto-generated.
  if (!gatepassNo) throw new Error('Please enter Gatepass Number manually');
  if (gatepassNo.length > 50) throw new Error('Gatepass Number must be 50 characters or fewer');
  if (!personName) throw new Error('Person Name is required');
  if (!['VEHICLE', 'BY_HAND'].includes(movementType)) throw new Error('Select Vehicle or By Hand');
  if (movementType === 'VEHICLE' && !vehicleNumber) throw new Error('Vehicle Number is required');

  const gatepassDate = parseDateInput_(dateInput);
  const photos = Array.isArray(body.photos) ? body.photos : [];
  const preparedPhotos = photos.map((photo, index) => preparePhoto_(photo, index));

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const gpSheet = getSheet_(CONFIG.SHEETS.GATEPASSES);
    const lastRow = gpSheet.getLastRow();
    if (lastRow >= 2) {
      const existingNumbers = gpSheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
      const duplicate = existingNumbers.some(n => String(n).trim().toLowerCase() === gatepassNo.toLowerCase());
      if (duplicate) throw new Error('This Gatepass Number already exists. Please enter a unique number.');
    }

    const folder = getPhotoFolder_();
    const now = new Date();
    const savedPhotos = [];

    preparedPhotos.forEach((item, index) => {
      const blob = Utilities.newBlob(item.bytes, item.mimeType, item.fileName);
      const file = folder.createFile(blob);
      if (CONFIG.SHARE_PHOTOS_WITH_LINK) {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }
      const url = 'https://drive.google.com/uc?export=view&id=' + file.getId();
      savedPhotos.push({
        fileName: item.fileName,
        fileId: file.getId(),
        url: url,
        photoNo: index + 1
      });
    });

    const photoUrls = savedPhotos.map(p => p.url);
    const photoIds = savedPhotos.map(p => p.fileId);

    // Text format protects manually entered IDs such as 0012 or GP/2026/09.
    const nextRow = gpSheet.getLastRow() + 1;
    gpSheet.getRange(nextRow, 1).setNumberFormat('@');
    gpSheet.getRange(nextRow, 4).setNumberFormat('@');
    gpSheet.getRange(nextRow, 1, 1, 12).setValues([[
      gatepassNo,
      gatepassDate,
      movementType,
      movementType === 'VEHICLE' ? vehicleNumber : 'BY HAND',
      personName,
      remarks,
      savedPhotos.length,
      photoUrls.join('\n'),
      photoIds.join('\n'),
      user.username,
      now,
      'SUBMITTED'
    ]]);
    gpSheet.getRange(nextRow, 2).setNumberFormat('dd-MM-yyyy');
    gpSheet.getRange(nextRow, 11).setNumberFormat('dd-MM-yyyy HH:mm:ss');

    if (savedPhotos.length) {
      const photoSheet = getSheet_(CONFIG.SHEETS.PHOTOS);
      const rows = savedPhotos.map(p => [
        gatepassNo, p.photoNo, p.fileName, p.fileId, p.url, user.username, now
      ]);
      photoSheet.getRange(photoSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    SpreadsheetApp.flush();
    return {
      ok: true,
      gatepassNo: gatepassNo,
      photoCount: savedPhotos.length,
      spreadsheetUrl: getSpreadsheet_().getUrl()
    };
  } finally {
    lock.releaseLock();
  }
}

function preparePhoto_(photo, index) {
  const dataUrl = String(photo && photo.dataUrl || '');
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([\s\S]+)$/i);
  if (!match) throw new Error('Unsupported image format for photo ' + (index + 1));
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > CONFIG.MAX_FILE_BYTES) {
    throw new Error('Photo ' + (index + 1) + ' exceeds 8 MB. Please reduce its size.');
  }
  const rawName = String(photo.name || ('gatepass-photo-' + (index + 1)));
  const safeName = rawName.replace(/[^\w.\- ]/g, '_').substring(0, 120);
  return { bytes: bytes, mimeType: match[1], fileName: safeName };
}

function parseDateInput_(value) {
  if (!value) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Gatepass Date must be YYYY-MM-DD');
  const p = value.split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  if (d.getFullYear() !== p[0] || d.getMonth() !== p[1] - 1 || d.getDate() !== p[2]) {
    throw new Error('Invalid Gatepass Date');
  }
  return d;
}

/* ----------------------------- READ DATA ---------------------------- */

function listGatepasses_(body, user) {
  const sh = getSheet_(CONFIG.SHEETS.GATEPASSES);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) {
    return { ok: true, records: [], spreadsheetUrl: getSpreadsheet_().getUrl(), user: user };
  }

  const records = [];
  const fromIso = String(body.fromDate || '');
  const toIso = String(body.toDate || '');
  const movementFilter = String(body.movementType || '').toUpperCase();
  const search = String(body.search || '').trim().toLowerCase();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;

    const submittedBy = String(row[9] || '');
    if (user.role === 'SECURITY' && submittedBy !== user.username) continue;

    const dateValue = row[1] instanceof Date ? row[1] : new Date(row[1]);
    const isoDate = isNaN(dateValue.getTime()) ? '' :
      Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');

    const movement = String(row[2] || '');
    if (fromIso && isoDate && isoDate < fromIso) continue;
    if (toIso && isoDate && isoDate > toIso) continue;
    if (movementFilter && movement !== movementFilter) continue;

    const haystack = [
      row[0], row[3], row[4], row[5], row[9]
    ].join(' ').toLowerCase();
    if (search && haystack.indexOf(search) === -1) continue;

    const photos = String(row[7] || '').split('\n').filter(Boolean);
    records.push({
      'Gatepass No.': String(row[0]),
      'Gatepass Date': isoDate ? Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'dd-MM-yyyy') : String(row[1] || ''),
      'Movement Type': movement,
      'Vehicle Number': String(row[3] || ''),
      'Person Name': String(row[4] || ''),
      'Remarks': String(row[5] || ''),
      'Photo Count': Number(row[6] || photos.length),
      'Photo URLs': String(row[7] || ''),
      'Photo File IDs': String(row[8] || ''),
      'Submitted By': submittedBy,
      'Submitted At': row[10] instanceof Date
        ? Utilities.formatDate(row[10], Session.getScriptTimeZone(), 'dd-MM-yyyy HH:mm:ss')
        : String(row[10] || ''),
      'Status': String(row[11] || ''),
      photos: photos
    });
  }

  records.reverse();
  return {
    ok: true,
    records: records,
    spreadsheetUrl: getSpreadsheet_().getUrl(),
    user: user
  };
}

/* -------------------------- USER MANAGEMENT ------------------------- */

/**
 * Run manually from Apps Script editor to add a user.
 * Example:
 * addUser('guard02', 'Security Guard 02', 'SECURITY', 'StrongPasswordHere');
 */
function addUser(username, displayName, role, password) {
  username = String(username || '').trim();
  displayName = String(displayName || '').trim();
  role = String(role || '').trim().toUpperCase();
  password = String(password || '');
  if (!username || !displayName || !password) throw new Error('Username, display name and password are required');
  if (!['SECURITY', 'MANAGEMENT'].includes(role)) throw new Error('Role must be SECURITY or MANAGEMENT');

  const sh = getSheet_(CONFIG.SHEETS.USERS);
  const names = sh.getLastRow() >= 2 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().flat() : [];
  if (names.some(n => String(n).toLowerCase() === username.toLowerCase())) {
    throw new Error('Username already exists');
  }
  addUser_(username, displayName, role, password);
  return 'User created: ' + username;
}

function addUser_(username, displayName, role, password) {
  const sh = getSheet_(CONFIG.SHEETS.USERS);
  const salt = Utilities.getUuid();
  sh.appendRow([username, displayName, role, salt, hashPassword_(password, salt), true]);
}

function setUserActive(username, active) {
  const sh = getSheet_(CONFIG.SHEETS.USERS);
  const values = sh.getDataRange().getDisplayValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase() === String(username).toLowerCase()) {
      sh.getRange(i + 1, 6).setValue(Boolean(active));
      return 'Updated ' + username;
    }
  }
  throw new Error('User not found');
}

function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + '|' + password,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64Encode(bytes);
}

/* ------------------------------- HELPERS ---------------------------- */

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || CONFIG.SPREADSHEET_ID;
  return SpreadsheetApp.openById(id);
}

function getSheet_(name) {
  const sh = getSpreadsheet_().getSheetByName(name);
  if (!sh) throw new Error('Sheet tab "' + name + '" is missing. Run setupExistingSpreadsheet() first.');
  return sh;
}

function ensureSheetAndHeaders_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const current = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), headers.length)).getDisplayValues()[0];
    const currentNonEmpty = current.filter(v => String(v).trim() !== '');
    const exact = headers.every((h, i) => String(current[i] || '').trim() === h);
    if (!exact && currentNonEmpty.length) {
      throw new Error(
        'Header mismatch in tab "' + name + '". Expected: ' + headers.join(' | ') +
        '. Found: ' + currentNonEmpty.join(' | ') +
        '. Please correct row 1 before running setup again.'
      );
    }
    if (!currentNonEmpty.length) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sh;
}

function getPhotoFolder_() {
  const props = PropertiesService.getScriptProperties();
  let folder = null;
  const id = props.getProperty('PHOTO_FOLDER_ID');
  if (id) {
    try { folder = DriveApp.getFolderById(id); folder.getName(); } catch (e) { folder = null; }
  }
  if (!folder) {
    folder = DriveApp.createFolder(CONFIG.PHOTO_FOLDER_NAME);
    props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  }
  return folder;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Diagnostic helper: run from Apps Script editor to confirm exact spreadsheet tabs and headers. */
function diagnoseExistingSpreadsheet() {
  const ss = getSpreadsheet_();
  const info = ss.getSheets().map(sh => ({
    name: sh.getName(),
    lastRow: sh.getLastRow(),
    lastColumn: sh.getLastColumn(),
    headers: sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0] : []
  }));
  Logger.log(JSON.stringify({ url: ss.getUrl(), sheets: info }, null, 2));
  return info;
}
