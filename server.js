import express from 'express';
import bodyParser from 'body-parser';
import { Client, middleware } from '@line/bot-sdk';
import QRCode from 'qrcode';
import * as service from './service.js';

const app = express();
app.use(bodyParser.json());

const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new Client(config);

// LINE webhook
app.post('/webhook', middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const msg = event.message.text.trim();

        // 簡單判斷是否符合戶名格式
        if (/^\d+[A-C]\d+$/.test(msg)) {
          await service.addUser(msg, userId, '住戶');
          await client.replyMessage(event.replyToken, { type: 'text', text: `已登記 ${msg}` });
        } else {
          await client.replyMessage(event.replyToken, { type: 'text', text: '請輸入正確戶號，例如 11A1' });
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// 管理頁面
app.get('/admin', async (req, res) => {
  const users = await service.getUsers();
  const parcels = await service.getParcels();
  let html = `<h1>管理端</h1>`;
  html += `<h2>住戶</h2><ul>`;
  users.forEach(u => html += `<li>${u[0]} / ${u[1]} / ${u[2]}</li>`);
  html += `</ul><h2>包裹</h2><ul>`;
  parcels.forEach(p => html += `<li>${p[1]} / ${p[0]} / ${p[2]}</li>`);
  html += `</ul>`;
  res.send(html);
});

// 新增包裹 & 發送 QR
app.post('/parcel', async (req, res) => {
  const { parcelId, houseId } = req.body;
  await service.addParcel(parcelId, houseId);

  // 生成 QR Code
  const qrText = `house:${houseId}`;
  const qrDataUrl = await QRCode.toDataURL(qrText);

  // 發送給戶內所有 userId
  const users = await service.getUsers();
  const targets = users.filter(u => u[0] === houseId).map(u => u[1]);
  for (const id of targets) {
    await client.pushMessage(id, { type: 'text', text: `有新包裹: ${parcelId}` });
    await client.pushMessage(id, { type: 'image', originalContentUrl: qrDataUrl, previewImageUrl: qrDataUrl });
  }
  res.json({ ok: true });
});

// QR 核銷
app.post('/collect', async (req, res) => {
  const { houseId } = req.body;
  await service.markParcelsCollected(houseId);
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => console.log('Server started'));
