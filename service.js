import { google } from 'googleapis';
import { Client } from "@line/bot-sdk";

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
const sheetId = process.env.SHEET_ID;

const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: SCOPES
});

const sheets = google.sheets({ version: 'v4', auth });

// LINE Client
const lineClient = new Client({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
});

// 住戶
export async function getUsers() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Users!A:C'
  });
  return res.data.values?.map(r => ({ houseId: r[0], userId: r[1], name: r[2] })) || [];
}

export async function addOrUpdateUser(houseId, userId, name) {
  const users = await getUsers();
  const index = users.findIndex(u => u.houseId === houseId || u.userId === userId);

  if (index >= 0) {
    // 已存在 → 更新姓名與 userId
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `Users!A${index+1}:C${index+1}`,
      valueInputOption: 'RAW',
      resource: { values: [[houseId, userId, name]] }
    });
  } else {
    // 新使用者
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Users!A:C',
      valueInputOption: 'RAW',
      resource: { values: [[houseId, userId, name]] }
    });
  }
}

// 刪除住戶
export async function deleteUser(houseId) {
  const users = await getUsers();
  const index = users.findIndex(u => u.houseId === houseId);
  if (index < 0) return;

  const requests = [{ deleteDimension: { range: { sheetId: 0, dimension: 'ROWS', startIndex: index, endIndex: index+1 } } }];
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: sheetId, resource: { requests } });
}

// 包裹
export async function getParcels() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Parcels!A:D'
  });
  return res.data.values?.map(r => ({ parcelId: r[0], houseId: r[1], status: r[2] || '未領取', time: r[3] || '' })) || [];
}

export async function addParcel(parcelId, houseId) {
  const users = await getUsers();
  const user = users.find(u => u.houseId === houseId);
  if (!user) throw new Error("戶名不存在");

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Parcels!A:D',
    valueInputOption: 'RAW',
    resource: { values: [[parcelId, houseId, '未領取', '']] }
  });

  // LINE 通知
  if (user.userId) {
    await lineClient.pushMessage(user.userId, { type: 'text', text: `您好，您有新的包裹到達，條碼：${parcelId}` });
  }
}

export async function markParcelCollected(parcelId) {
  const parcels = await getParcels();
  const index = parcels.findIndex(p => p.parcelId === parcelId);
  if (index < 0) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Parcels!C${index+1}:D${index+1}`,
    valueInputOption: 'RAW',
    resource: { values: [['已領取', new Date().toISOString()]] }
  });
}
