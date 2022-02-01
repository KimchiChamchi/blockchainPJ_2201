const WebSocket = require("ws");
const BC = require("./blockchain");
const TX = require("./transaction");
const TP = require("./transactionPool");

// 연결된 소켓목록
const sockets = [];

// 메시지 타입 정의
const MessageType = {
  QUERY_LATEST: 0, // 네가 가진 마지막 블록 달라
  QUERY_ALL: 1, // 네가 가진 블록체인 달라
  RESPONSE_BLOCKCHAIN: 2, // 내 블록체인을 주갔어
  QUERY_TRANSACTION_POOL: 3, // 네가 가진 트랜잭션 풀 달라
  RESPONSE_TRANSACTION_POOL: 4, // 내 친히 트랜잭션 풀을 너에게 주갔어
};

// 내 웹소켓 서버 개통
const initP2PServer = (p2pPort) => {
  // 해당 포트로 새 웹소켓 서버를 개통하고
  const server = new WebSocket.Server({ port: p2pPort });
  // 서버가 개통됐으면 앞으로 이 소켓에서 무엇을 할건지 명시해야함
  server.on("connection", (ws) => {
    // 소켓 연결 초기화 할거임(그럼 앞으로 initConnection에 들어있는 내용들)
    // (시행할 수 있음)
    initConnection(ws);
  });
  console.log("내 소켓 " + p2pPort + "포트 개통");
};

// 소켓연결목록 가져오기
const getSockets = () => sockets;

// 소켓 연결 초기화
const initConnection = (ws) => {
  // 해당 소켓을 내 연결목록에 추가하기
  sockets.push(ws);
  // 메시지 핸들러 초기화(다른 소켓 처음 연결할때 서로 빈 메시지 교환됨)
  initMessageHandler(ws);
  // 에러 핸들러 초기화
  initErrorHandler(ws);
  // 해당 소켓에게 마지막 블록 달라고 하기
  write(ws, queryChainLengthMsg());

  // 해당 소켓에게 답장 받기까지 잠시 기다렸다가
  setTimeout(() => {
    // 연결된 모두에게 트랜잭션 풀 달라고하기
    broadcast(queryTransactionPoolMsg());
  }, 500);
};

// 메시지 받으면 따를 매뉴얼
const initMessageHandler = (ws) => {
  const { handleReceivedTransaction } = require("./blockchain");
  ws.on("message", (data) => {
    try {
      // 제이슨 형식으로 받은 메시지 원래 형태로 변환
      const message = JSON.parse(data);

      // 메시지 변환한게 null이면 오류메시지
      if (message === null) {
        console.log("받은 메시지 " + data + " 를 분석할 수 없어요");
        return;
      }
      console.log("메시지 왔어요");
      // 메시지 타입에 따라 무엇을 할지...
      switch (message.type) {
        case MessageType.QUERY_LATEST:
          console.log(
            "상대가 마지막 블록을 달라고 했어요. 답장으로 마지막 블록을 보낼게요"
          );
          write(ws, responseLatestMsg());
          break;
        case MessageType.QUERY_ALL:
          console.log(
            "상대가 블록체인을 달라고 했어요. 답장으로 내 블록체인을 보낼게요"
          );
          write(ws, responseChainMsg());
          break;
        case MessageType.RESPONSE_BLOCKCHAIN:
          const receivedBlocks = JSON.parse(message.data);
          if (receivedBlocks === null) {
            console.log(
              "받은 메시지에 블록이 담겨있다는데 까보니 뭐가 없네요?",
              JSON.stringify(message.data)
            );
            break;
          }
          console.log("받은 메시지에 블록이 담겨있어요 내것과 비교해야겠어요");
          handleBlockchainResponse(receivedBlocks);
          break;
        case MessageType.QUERY_TRANSACTION_POOL:
          console.log(
            "상대가 트랜잭션풀을 달라고 했어요. 답장에 내 트랜잭션풀을 담아 보낼게요"
          );
          write(ws, responseTransactionPoolMsg());
          break;
        case MessageType.RESPONSE_TRANSACTION_POOL:
          const receivedTransactions = JSON.parse(message.data);
          if (receivedTransactions === null) {
            console.log(
              "받은 메시지에 트랜잭션풀이 들어있다는데 까보니 뭐가 없네요?",
              JSON.stringify(message.data)
            );
            break;
          }
          console.log(
            "받은 메시지에 트랜잭션풀이 있어요. 검증해서 내 트랜잭션풀에 담고 소문낼 거에오"
          );
          // 받은 트랜잭션들(트랜잭션풀) forEach로 하나씩 풀어서
          receivedTransactions.forEach((transaction) => {
            try {
              // 검증 후 내 트랜잭션풀에 넣고
              handleReceivedTransaction(transaction);
              // 새로 완성된 트랜잭션풀 알리기
              broadCastTransactionPool();
            } catch (e) {
              console.log(e.message);
            }
          });
          break;
      }
    } catch (e) {
      console.log(e);
    }
  });
};

// 해당 소켓에게 해당 메시지 전송하기
const write = (ws, message) => ws.send(JSON.stringify(message));

// 동네방네 소문내기
const broadcast = (message) =>
  // 내 소켓연결목록에 있는 모두에게 마구마구 메시지 전송
  sockets.forEach((socket) => write(socket, message));

// 상대에게 마지막 블록 달라고 하는 메시지
const queryChainLengthMsg = () => ({
  type: MessageType.QUERY_LATEST,
  data: null,
});

// 상대에게 가진 블록체인 전부 내놓으라고 협박하는 메시지
const queryAllMsg = () => ({ type: MessageType.QUERY_ALL, data: null });

// 상대에게 내 블록체인 전체를 담아서 보내는 메시지
function responseChainMsg() {
  const { getBlockchain } = require("./blockchain");
  return {
    type: MessageType.RESPONSE_BLOCKCHAIN,
    data: JSON.stringify(getBlockchain()),
  };
}

// 상대에게 내 마지막 블록 담아서 보내는 메시지
function responseLatestMsg() {
  const { getLatestBlock } = require("./blockchain");
  return {
    type: MessageType.RESPONSE_BLOCKCHAIN,
    data: JSON.stringify([getLatestBlock()]),
  };
}

// 상대에게 트랜잭션풀(멤풀) 달라고 하는 메시지
const queryTransactionPoolMsg = () => ({
  type: MessageType.QUERY_TRANSACTION_POOL,
  data: null,
});

// 상대에게 내 트랜잭션풀(멤풀) 담아 보내는 메시지
const responseTransactionPoolMsg = () => ({
  type: MessageType.RESPONSE_TRANSACTION_POOL,
  data: JSON.stringify(TP.getTransactionPool()),
});

// 에러 핸들러 초기화
const initErrorHandler = (ws) => {
  //
  const closeConnection = (myWs) => {
    console.log(myWs.url, "와 연결이 끊어졌어요");
    sockets.splice(sockets.indexOf(myWs), 1);
  };
  // 해당 소켓이 닫히거나 오류가 있으면 연결목록에서 제거
  ws.on("close", () => closeConnection(ws));
  ws.on("error", () => closeConnection(ws));
};

// 상대에게 블록체인 또는 마지막 블록 받으면 처리할 매뉴얼
const handleBlockchainResponse = (receivedBlocks) => {
  const {
    isValidBlockStructure,
    getLatestBlock,
    replaceChain,
    addBlockToChain,
  } = require("./blockchain");
  // 전달받은 블록or블록체인의 길이가 0
  if (receivedBlocks.length === 0) {
    console.log("이상해요. 전달받은 블록체인의 길이가 0이래요");
    return;
  }
  // 전달받은 블록or블록체인의 마지막블록 변수로 저장
  const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
  // 블록 구조 검증
  if (!isValidBlockStructure(latestBlockReceived)) {
    console.log("전달받은 블록의 구조가 이상해요");
    return;
  }
  // 내 블록체인의 마지막 블록 변수로 저장
  const latestBlockHeld = getLatestBlock();
  // 전달받은 마지막블록의 인덱스가 내 마지막블록의 인덱스보다 크면
  if (latestBlockReceived.index > latestBlockHeld.index) {
    console.log("내 블록보다 길 것으로 추정되는 블록을 받았어. 비교해보자");
    // 내 마지막 블록의 해시랑 전달받은 마지막블록의 이전해시가 같으면
    // (전달받은 블록이 내 블록보다 한개 긺)
    if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
      // 내 블록체인에 전달받은 마지막블록 연결하고 동네방네 소문내기
      if (addBlockToChain(latestBlockReceived)) {
        broadcast(responseLatestMsg());
      }
      // 전달받은 블록or블록체인의 길이가 1일때
      // (전달받은 블록이 내것보다 2개이상 긴 상태인데 마지막블록 한개만 받은 상태)
    } else if (receivedBlocks.length === 1) {
      console.log(
        "전달받은 블록이 내것보다 2개이상 길대요. 이번엔 블록체인을 받아봐야겠어요"
      );
      // 전달받은 블록이 한개니까 replaceChain 하기 위해 블록체인 통째로 줘보라고 하기
      broadcast(queryAllMsg());
    } else {
      console.log(
        "전달받은 블록체인이 내것보다 더 기니까 검증해봐서 교체하던가 해야짐"
      );
      replaceChain(receivedBlocks);
    }
    // 전달받은 블록or블록체인이 내것과 길이가 같거나 짧으면 아무것도 안하기
  } else {
    console.log("전달받은 블록이 내 블록보다 길지 않네. 그럼 가만 있어야지");
  }
};

// 마지막 블록 소문내기
const broadcastLatest = () => {
  broadcast(responseLatestMsg());
};

// 받은 주소 소켓 연결하기
const connectToPeers = (newPeer) => {
  const ws = new WebSocket(newPeer);
  // 해당 주소가 열려있으면 연결초기화
  ws.on("open", () => {
    initConnection(ws);
  });
  // 주소가 문제가 있으면 에러 메시지
  ws.on("error", () => {
    console.log("소켓이 연결에 실패했어요 뭔가 문제가 있나봐요");
  });
};

// 트랜잭션 풀 소문내기
const broadCastTransactionPool = () => {
  broadcast(responseTransactionPoolMsg());
};

module.exports = {
  connectToPeers,
  broadcastLatest,
  broadCastTransactionPool,
  initP2PServer,
  getSockets,
};
