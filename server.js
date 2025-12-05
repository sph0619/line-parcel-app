import express from "express";
import { middleware, Client } from "@line/bot-sdk";
import { addUser } from "./service.js"; // ⭐ 加上 service.js

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const app = express();

// 保留 raw body 給 LINE SDK 驗證簽名
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.post("/webhook", middleware(config), async (req, res) => {
  const events = req.body.events;
  const client = new Client(config);

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const text = event.message.text.trim();
      
      // 假設使用者輸入格式是 "戶名 名字"
      const parts = text.split(" ");
      if (parts.length === 2) {
        const [houseId, name] = parts;
        try {
          await addUser(houseId, event.source.userId, name); // ⭐ 呼叫 service.js
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: `已將資料加入 Google Sheet：戶名 ${houseId}, 名字 ${name}`
          });
        } catch (err) {
          console.error(err);
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: "加入資料時發生錯誤，請稍後再試。"
          });
        }
      } else {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "收到你的訊息了喔！請輸入「戶名 名字」格式。"
        });
      }
    }
  }

  res.status(200).end();
});

app.get("/", (req, res) => res.send("LINE bot running!"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on " + port));
