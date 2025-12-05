import express from "express";
import { Client, middleware } from "@line/bot-sdk";
import { GoogleSheetService } from "./googleSheetService.js";

const app = express();
app.use(express.json());

// LINE config
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// LINE client
const client = new Client(config);

// Google Sheet Service 初始化（用 try/catch 防止 webhook 500）
let sheetService;
try {
  sheetService = new GoogleSheetService(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    process.env.SHEET_ID
  );
  console.log("[Sheet] GoogleSheetService 初始化成功");
} catch (err) {
  console.error("[Sheet] 初始化失敗：", err);
}

app.post("/webhook", middleware(config), async (req, res) => {
  try {
    // LINE Verify 時 events 可能不存在
    const events = req.body.events || [];

    for (const event of events) {
      try {
        // 只處理文字訊息
        if (event.type === "message" && event.message.type === "text") {
          const userId = event.source.userId;
          const msg = event.message.text.trim();
          const replyToken = event.replyToken;

          // 預防 GoogleSheetService 尚未初始化成功
          if (!sheetService) {
            await client.replyMessage(replyToken, {
              type: "text",
              text: "❌ Google Sheet 初始化失敗，請聯絡管理員。",
            });
            continue;
          }

          // 查看資料
          if (msg === "查看會員名單") {
            const users = await sheetService.getUsers();
            const text = users.length
              ? users.join("\n")
              : "目前沒有紀錄任何會員。";

            await client.replyMessage(replyToken, {
              type: "text",
              text,
            });
            continue;
          }

          // 加入會員
          if (msg.startsWith("加入會員")) {
            const name = msg.replace("加入會員", "").trim();
            if (!name) {
              await client.replyMessage(replyToken, {
                type: "text",
                text: "請輸入會員名稱，例如：加入會員 王小明",
              });
              continue;
            }

            await sheetService.addUser({ userId, name });

            await client.replyMessage(replyToken, {
              type: "text",
              text: `已加入會員：${name}`,
            });
            continue;
          }

          // 其他訊息回覆
          await client.replyMessage(replyToken, {
            type: "text",
            text: `你說的是：${msg}`,
          });
        }
      } catch (eventErr) {
        console.error("[Event Error]", eventErr);
      }
    }

    // 🔥 最重要：無論如何 ALWAYS 回 200 給 LINE
    res.sendStatus(200);
  } catch (err) {
    console.error("[Webhook Error]", err);
    res.sendStatus(200); // 任何錯誤仍回 200，避免 Verify 失敗
  }
});

// Render 需要這段，否則會休眠
app.get("/", (_, res) => res.send("LINE bot is running"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on ${port}`));
