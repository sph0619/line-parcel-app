const express = require("express");
const { Client, middleware } = require("@line/bot-sdk");
const { google } = require("googleapis");

// LINE config 
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

// Google Sheet Config
const SHEET_ID = process.env.SHEET_ID; 
const GOOGLE_SERVICE_ACCOUNT = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

const sheetsClient = new google.auth.JWT(
  GOOGLE_SERVICE_ACCOUNT.client_email,
  null,
  GOOGLE_SERVICE_ACCOUNT.private_key,
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const app = express();
app.use(express.json());

// 建立 LINE 客戶端
const client = new Client(config);

// Google Sheet: 寫入資料
async function appendUserData(userId, unitCode) {
  const sheets = google.sheets({ version: "v4", auth: sheetsClient });
  return sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "Users!A:D",
    valueInputOption: "USER_ENTERED",
    resource: {
      values: [[userId, unitCode, new Date().toISOString()]]
    }
  });
}

// Google Sheet: 檢查是否已綁定
async function isUserBound(userId) {
  const sheets = google.sheets({ version: "v4", auth: sheetsClient });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Users!A:B"
  });

  const rows = res.data.values || [];
  return rows.some(r => r[0] === userId);
}

// 檢查戶號是否正確
function validateUnitCode(code) {
  if (!code || code.length < 3 || code.length > 4) return false;

  // 拆解
  const floor = parseInt(code.match(/^\d+/)?.[0]);
  const building = code.match(/[ABC]/)?.[0];
  const unit = parseInt(code.match(/\d+$/)?.[0]);

  if (!floor || floor < 1 || floor > 19) return false;
  if (!["A", "B", "C"].includes(building)) return false;

  // A / C 是 1~3
  if (building === "A" || building === "C") {
    if (unit < 1 || unit > 3) return false;
  }

  // B 是 1~4
  if (building === "B") {
    if (unit < 1 || unit > 4) return false;
  }

  return true;
}

// 處理 Webhook
app.post("/webhook", middleware(config), async (req, res) => {
  const events = req.body.events;

  events.forEach(async (event) => {
    const userId = event.source?.userId;

    // 1. 用戶加入好友 follow
    if (event.type === "follow") {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "歡迎加入 📦\n請輸入您的戶號（例如：11A1）以完成綁定。"
      });
      return;
    }

    // 2. 用戶傳送文字（戶號綁定）
    if (event.type === "message" && event.message.type === "text") {
      const text = event.message.text.toUpperCase();

      // 已綁定過
      if (await isUserBound(userId)) {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "您已經完成綁定囉 🎉\n若需修改戶號請聯絡管理員。"
        });
        return;
      }

      // 戶號格式檢查
      if (!validateUnitCode(text)) {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "戶號格式不正確 🧐\n請輸入像「11A1」這樣的格式。"
        });
        return;
      }

      // 寫入 Google Sheet
      await appendUserData(userId, text);

      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `已完成綁定 🎉\n您的戶號是：${text}\n之後有包裹會自動通知您！📦`
      });
    }
  });

  res.sendStatus(200);
});

// Render 的 PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
