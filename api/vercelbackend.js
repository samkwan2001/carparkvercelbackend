
const client = new MongoClient("mongodb+srv://vercel-admin-user:root@samkwan2001.jzkg5yg.mongodb.net/");
let db;

async function connectDb(req, res, next) {
  if (!db) {
    await client.connect();
    db = client.db('webrtc_db');
  }
  req.db = db;
  next();
}

// 1. 客户端获取 Hoster 的 Offer，同时上报自己的存在
app.get('/api/get-room', connectDb, async (req, res) => {
  const { roomId, clientId } = req.query;
  if (!roomId || !clientId) return res.status(400).json({ error: 'Missing parameters' });

  const room = await req.db.collection('rooms').findOne({ _id: roomId });
  if (!room) return res.status(404).json({ error: 'Room not found' });

  // 【Choose One 核心逻辑】：如果你想在后端限制只允许特定 Client 进来
  // if (room.allowedClientId && room.allowedClientId !== clientId) {
  //     return res.status(403).json({ error: '你不是被选中的客户端' });
  // }

  // 返回公用的 Offer，以及专门定向给这个客户端的后端 ICE 候选
  const clientData = room.clients?.[clientId] || {};
  res.json({
    // 优先返回专属 offer
    offer: clientData.offer,
    backendCandidates: clientData.backendCandidatesForThisClient || []
  });
});

// 2. 客户端提交自己的 Answer 和 ICE
app.post('/api/submit-client-signal', connectDb, async (req, res) => {
  console.log(req.url.split("?time=")[1], req.body.answer?.type || req.body.candidate?.usernameFragment)
  const { roomId, clientId, answer, candidate } = req.body;
  const collection = req.db.collection('rooms');

  const updateQuery = {};

  // 使用 MongoDB 的 $set 动态更新指定 clientId 的嵌套对象
  if (answer) {
    updateQuery[`clients.${clientId}.answer`] = answer;
    updateQuery[`clients.${clientId}.status`] = "answered";
  }

  const updatePayload = { $set: updateQuery };

  if (candidate) {
    // 动态追加该客户端的 ICE 到它自己的数组里
    updatePayload.$push = { [`clients.${clientId}.clientCandidates`]: candidate };
  }

  await collection.updateOne({ _id: roomId }, updatePayload);
  res.json({ success: true });
});

app.post('/api/register-client', connectDb, async (req, res) => {
  const { roomId, clientId } = req.body;
  if (!roomId || !clientId) return res.status(400).json({ error: 'Missing parameters' });

  const collection = req.db.collection('rooms');

  // 在指定 roomId 下的 clients 字典中，为该 clientId 动态初始化一个基础空结构
  // 这会直接触发后端的 MongoDB .watch() 变更流
  await collection.updateOne(
    { _id: roomId },
    { 
      $set: { 
        [`clients.${clientId}.status`]: "registered",
        [`clients.${clientId}.clientCandidates`]: [],
        [`clients.${clientId}.backendCandidatesForThisClient`]: []
      } 
    }
  );

  res.json({ success: true });
});




// app.listen(7000, () => { })
// module.exports = app;
