import express from "express";

const app = express();
app.use(express.json());

// LINE Webhook 接收端點
app.post("/callback", (req, res) => {
  console.log("收到 LINE Webhook：");
  console.log(JSON.stringify(req.body, null, 2));

  res.send("OK");
});

// Render 會自己給 PORT
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Server 啟動 on port " + port);
});
