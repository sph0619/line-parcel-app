import express from "express";
import { middleware, Client } from "@line/bot-sdk";
import {
  getUsers, addOrUpdateUser, deleteUser,
  getParcels, addParcel, markParcelCollected
} from './service.js';

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const app = express();

// 保留 raw body 給 LINE webhook 驗證
app.use(express.json({ verify: (req,res,buf)=> req.rawBody=buf }));

// LINE Webhook
app.post("/webhook", middleware(config), async (req, res) => {
  const client = new Client(config);
  for (const event of req.body.events) {
    if (event.type === "message" && event.message.type === "text") {
      const text = event.message.text.trim();
      const match = text.match(/^(\d+[A-Z]?\d*)\s*(.*)$/);
      if (match) {
        const houseId = match[1];
        const name = match[2] || '住戶';
        await addOrUpdateUser(houseId, event.source.userId, name);
        await client.replyMessage(event.replyToken, { type: 'text', text: `已登記 ${houseId} ${name}` });
      } else {
        await client.replyMessage(event.replyToken, { type: 'text', text: "戶名格式錯誤，請輸入例如：11A1 小明" });
      }
    }
  }
  res.status(200).end();
});

// 管理員網頁
app.use(express.static('public'));

// API: 取得住戶
app.get('/api/users', async (req,res) => res.json(await getUsers()));

// API: 取得包裹
app.get('/api/parcels', async (req,res) => res.json(await getParcels()));

// API: 新增包裹
app.post('/api/addParcel', async (req,res) => {
  try {
    await addParcel(req.body.parcelId, req.body.houseId);
    res.json({ ok: true });
  } catch(e) { res.status(400).json({ ok:false, error:e.message }); }
});

// API: 標記已領取
app.post('/api/markCollected', async (req,res) => {
  try {
    await markParcelCollected(req.body.parcelId);
    res.json({ ok:true });
  } catch(e){ res.status(400).json({ok:false,error:e.message})}
});

// API: 刪除住戶
app.post('/api/deleteUser', async (req,res) => {
  try {
    await deleteUser(req.body.houseId);
    res.json({ ok:true });
  } catch(e){ res.status(400).json({ok:false,error:e.message})}
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on " + port));
