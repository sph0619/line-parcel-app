import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const sheetId = process.env.SHEET_ID;

const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: SCOPES
});

const sheets = google.sheets({ version: 'v4', auth });

export async function getUsers() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Users!A:C' // A:戶名, B:userId, C:名字
  });
  return res.data.values || [];
}

export async function addUser(houseId, userId, name) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Users!A:C',
    valueInputOption: 'RAW',
    resource: { values: [[houseId, userId, name]] }
  });
}

export async function getParcels() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Parcels!A:D' // A:包裹號, B:戶名, C:狀態, D:掃描時間
  });
  return res.data.values || [];
}

export async function addParcel(parcelId, houseId) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Parcels!A:D',
    valueInputOption: 'RAW',
    resource: { values: [[parcelId, houseId, '未領取', '']] }
  });
}

export async function markParcelsCollected(houseId) {
  const parcels = await getParcels();
  const requests = [];
  parcels.forEach((row, index) => {
    if (row[1] === houseId && row[2] !== '已領取') {
      requests.push({
        range: `Parcels!C${index + 1}:D${index + 1}`,
        values: [['已領取', new Date().toISOString()]]
      });
    }
  });
  for (let r of requests) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: r.range,
      valueInputOption: 'RAW',
      resource: { values: r.values }
    });
  }
}
