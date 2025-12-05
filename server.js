import express from "express";
import { middleware, Client } from "@line/bot-sdk";

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const app = express();

// ⭐ 這段是關鍵：保留 raw body 給 LINE SDK 驗證簽名
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf; // 保留原始 body
  }
}));

// ⭐ LINE middleware 必須用 raw body
app.post("/webhook", middleware(config), async (req, res) => {
  const events = req.body.events;

  const client = new Client(config);

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "收到你的訊息了喔！"
      });
    }
  }

  res.status(200).end();
});

app.get("/", (req, res) => res.send("LINE bot running!"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on " + port));
