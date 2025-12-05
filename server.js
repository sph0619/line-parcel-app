import express from "express";
import { middleware, Client } from "@line/bot-sdk";
import { getUsers, addOrUpdateUser, addParcel, markParcelCollected, deleteUser, getParcels } from "./service.js";

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

app.post("/webhook", middleware(config), async (req, res) => {
  const events = req.body.events;
  const client = new Client(config);

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const text = event.message.text.trim();
      const userId = event.source.userId;

      // 假設輸入格式：11A1 小明
      const match = text.match(/^(\S+)\s+(.+)$/);
      if (!match) {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "請輸入正確格式，例如：11A1 小明"
        });
        continue;
      }

      const [_, houseId, name] = match;

      try {
        await addOrUpdateUser(houseId, userId, name);
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: `已登記：${houseId} - ${name}`
        });
      } catch (err) {
        console.error(err);
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "登記時發生錯誤，請稍後再試"
        });
      }
    }
  }

  res.status(200).end();
});

// 管理員網頁 API
app.get("/admin/users", async (req, res) => {
  const users = await getUsers();
  res.json(users);
});

app.get("/admin/parcels", async (req, res) => {
  const parcels = await getParcels();
  res.json(parcels);
});

app.post("/admin/parcels", express.json(), async (req, res) => {
  const { parcelId, houseId } = req.body;
  try {
    await addParcel(parcelId, houseId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/admin/collect", express.json(), async (req, res) => {
  const { parcelId } = req.body;
  try {
    await markParcelCollected(parcelId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get("/", (req, res) => res.send("LINE bot running!"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on " + port));
