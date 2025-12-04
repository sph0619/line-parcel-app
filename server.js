import express from "express";
import bodyParser from "body-parser";
import { google } from "googleapis";
import line from "@line/bot-sdk";

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

/** ---------------- LINE BOT ---------------- **/
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new line.Client(config);

app.post("/webhook", line.middleware(config), async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const userId = event.source.userId;
      const content = event.message.text.trim().toUpperCase();

      if (/^\d{1,2}[A-C]\d$/.test(content)) {
        await addOrUpdateUser(userId, content);
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: `已登記/更新戶號: ${content}`,
        });
      } else {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: `格式錯誤，請輸入正確戶號，如 11A1`,
        });
      }
    }
  }
  res.sendStatus(200);
});

/** ---------------- Google Sheet ---------------- **/
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const CREDENTIALS = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

const auth = new google.auth.GoogleAuth({
  credentials: CREDENTIALS,
  scopes: SCOPES,
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.SHEET_ID;
const SHEET_NAME = "ParcelSystem";

async function addOrUpdateUser(userId, unitCode) {
  const now = new Date().toISOString();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:C`,
  });
  const rows = response.data.values || [];

  const index = rows.findIndex((r) => r[0] === userId);

  if (index >= 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!B${index + 1}:C${index + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[unitCode, now]],
      },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:C`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[userId, unitCode, now]],
      },
    });
  }
}

/** ---------------- 管理頁面 ---------------- **/
app.get("/admin", async (req, res) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:C`,
  });
  const rows = response.data.values || [];
  let html = `<h2>已登記住戶清單</h2><table border="1"><tr><th>UserId</th><th>戶號</th><th>登記時間</th></tr>`;
  rows.forEach((r) => {
    html += `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`;
  });
  html += `</table>`;
  res.send(html);
});

/** ---------------- 啟動伺服器 ---------------- **/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
