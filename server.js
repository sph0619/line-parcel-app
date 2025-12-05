// server.js
import express from "express";
import { middleware, Client } from "@line/bot-sdk";
import { addUser, getUsers, addParcel, markParcelsCollected } from "./service.js";

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const app = express();

// ⭐ 保留 raw body 給 LINE SDK 驗證簽名
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// ---------- LINE Webhook ----------
app.post("/webhook", middleware(config), async (req, res) => {
  const events = req.body.events;
  const client = new Client(config);

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const text = event.message.text.trim();
      const userId = event.source.userId;

      // 驗證戶名格式 (假設 11A1 這種格式)
      const validHouse = /^[0-9]{2}[A-Z][0-9]$/i.test(text);
      if (!validHouse) {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "戶名格式錯誤，請輸入正確格式，如 11A1"
        });
        continue;
      }

      // 自動判斷新使用者 / 已存在使用者
      const users = await getUsers();
      const existing = users.find(u => u[1] === userId);
      if (!existing) {
        await addUser(text.toUpperCase(), userId, "住戶");
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: `您好，${text.toUpperCase()} 已登記完成！`
        });
      } else {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: `您的資料已存在，戶名: ${existing[0]}`
        });
      }
    }
  }

  res.status(200).end();
});

// ---------- 管理員 API ----------
// 新增包裹 (連續掃描前端)
app.post("/api/addParcel", async (req, res) => {
  try {
    const { parcelId, houseId } = req.body;
    if (!parcelId || !houseId) return res.json({ ok: false, error: "缺少參數" });

    // 加入 Google Sheet
    await addParcel(parcelId, houseId.toUpperCase());

    // 自動 LINE 通知住戶
    const users = await getUsers();
    const user = users.find(u => u[0].toUpperCase() === houseId.toUpperCase());
    if (user) {
      const client = new Client(config);
      await client.pushMessage(user[1], {
        type: "text",
        text: `📦 您有新的包裹到達！條碼: ${parcelId}`
      });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, error: e.message });
  }
});

// 標記包裹已領取
app.post("/api/collectParcel", async (req, res) => {
  try {
    const { houseId } = req.body;
    if (!houseId) return res.json({ ok: false, error: "缺少戶名" });
    await markParcelsCollected(houseId.toUpperCase());
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.json({ ok: false, error: e.message });
  }
});

// 測試 server
app.get("/", (req, res) => res.send("LINE bot running!"));

// 啟動 server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on " + port));
