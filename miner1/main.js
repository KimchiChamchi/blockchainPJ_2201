const bodyParser = require("body-parser");
const express = require("express");
const cors = require("cors");
const _ = require("lodash");
const BC = require("./blockchain");
const P2P = require("./p2p");
const TX = require("./transaction");
const TP = require("./transactionPool");
const WALLET = require("./wallet");

const httpPort = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort = parseInt(process.env.P2P_PORT) || 6001;

const initHttpServer = (myHttpPort) => {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  app.use((err, req, res, next) => {
    if (err) {
      res.status(400).send(err.message);
    }
  });

  app.get("/blocks", (req, res) => {
    console.log(BC.getBlockchain());
    res.send(BC.getBlockchain());
  });

  app.get("/block/:hash", (req, res) => {
    const block = _.find(BC.getBlockchain(), { hash: req.params.hash });
    res.send(block);
  });

  app.get("/transaction/:id", (req, res) => {
    const tx = _(BC.getBlockchain())
      .map((blocks) => blocks.data)
      .flatten()
      .find({ id: req.params.id });
    res.send(tx);
  });

  app.get("/address/:address", (req, res) => {
    const unspentTxOuts = _.filter(
      BC.getUnspentTxOuts(),
      (uTxO) => uTxO.address === req.params.address
    );
    res.send({ unspentTxOuts: unspentTxOuts });
  });

  app.get("/unspentTransactionOutputs", (req, res) => {
    res.send(BC.getUnspentTxOuts());
  });

  app.get("/myUnspentTransactionOutputs", (req, res) => {
    res.send(BC.getMyUnspentTransactionOutputs());
  });

  app.post("/mineRawBlock", (req, res) => {
    if (req.body.data == null) {
      res.send("data parameter is missing");
      return;
    }
    const newBlock = BC.generateRawNextBlock(req.body.data);
    if (newBlock === null) {
      res.status(400).send("could not generate block");
    } else {
      res.send(newBlock);
    }
  });

  app.post("/mineBlock", (req, res) => {
    const newBlock = BC.generateNextBlock();
    if (newBlock === null) {
      res.status(400).send("could not generate block");
    } else {
      res.send(newBlock);
    }
  });

  // 내 지갑 잔고 조회
  app.get("/balance", (req, res) => {
    const balance = BC.getAccountBalance();
    res.send({ balance: balance });
  });

  // 지갑 공개키 확인
  app.get("/address", (req, res) => {
    const address = WALLET.getPublicFromWallet();
    res.send({ address: address });
  });

  app.post("/mineTransaction", (req, res) => {
    const address = req.body.address;
    const amount = req.body.amount;
    try {
      const resp = BC.generatenextBlockWithTransaction(address, amount);
      res.send(resp);
    } catch (e) {
      console.log(e.message);
      res.status(400).send(e.message);
    }
  });

  // 트랜잭션 만들기
  app.post("/sendTransaction", (req, res) => {
    // console.log("왓니?");
    // console.log(req.body);
    try {
      // 전달받은 상대의 지갑 공개키와 코인수를 변수에 저장
      const address = req.body.address;
      const amount = parseInt(req.body.amount);

      // 해당 지갑주소나 코인수가 undefined면 오류
      if (address === undefined || amount === undefined) {
        throw Error("보낼 주소나 코인이 문제가 있어요");
      }
      // address와 amount를 토대로 트랜잭션을 만들고 broadCast 하기
      const resp = BC.sendTransaction(address, amount);
      console.log("나는 utxo");
      console.log(BC.getUnspentTxOuts());
      res.send(resp);
    } catch (e) {
      console.log(e.message);
      res.status(400).send(e.message);
    }
  });

  app.get("/transactionPool", (req, res) => {
    res.send(TP.getTransactionPool());
  });

  app.get("/peers", (req, res) => {
    res.send(
      P2P.getSockets().map(
        (s) => s._socket.remoteAddress + ":" + s._socket.remotePort
      )
    );
  });

  // 받은 주소로 소켓 연결하기
  app.post("/addPeer", (req, res) => {
    P2P.connectToPeers(req.body.peer);
    res.send();
  });

  app.post("/stop", (req, res) => {
    res.send({ msg: "stopping server" });
    process.exit();
  });

  app.listen(myHttpPort, () => {
    console.log("내 서버 " + myHttpPort + "포트 개통");
  });
};

initHttpServer(httpPort);
P2P.initP2PServer(p2pPort);
WALLET.initWallet();