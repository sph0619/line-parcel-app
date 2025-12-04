// server.js
const express = require('express');
const bodyParser = require('body-parser');
const line = require('@line/bot-sdk');
const path = require('path');

const config = {
  channelAccessToken: '你的Channel Access Token',
  channelSecret: '你的Channel Secret'
};

const client = new line.Client(config);
const app = express();

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'))); // 網頁資源

// 模擬資料庫
let parcels = []; // {id, name, userId, content, pickedUp}

// 後台 API：新增包裹
app.post('/api/add-parcel', (req, res) => {
  const { name, userId, content } = req.body;
  if (!name || !userId || !content) return res.status(400).send('缺少欄位');

  const parcel = { id: parcels.length + 1, name, userId, content, pickedUp: false };
  parcels.push(parcel);

  // 發送 LINE 通知
  client.pushMessage(userId, {
    type: 'text',
    text: `📦 您有新的包裹：${content}，請盡快領取！`
  }).catch(err => console.error(err));

  res.json({ success: true, parcel });
});

// 後台 API：標記已領取
app.post('/api/pickup', (req, res) => {
  const { id } = req.body;
  const parcel = parcels.find(p => p.id === Number(id));
  if (!parcel) return res.status(404).send('找不到包裹');

  parcel.pickedUp = true;
  res.json({ success: true, parcel });
});

// 後台 API：取得所有包裹
app.get('/api/parcels', (req, res) => {
  res.json(parcels);
});

// 網頁首頁
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
