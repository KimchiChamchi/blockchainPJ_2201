const CryptoJS = require("crypto-js");
const _ = require("lodash");
const P2P = require("./p2p");
const TX = require("./transaction");
const TP = require("./transactionPool");
const { hexToBinary } = require("./util");
const WALLET = require("./wallet");

// // 블록 구조 정의
// class Block {
//   constructor(header, body) {
//     this.header = header;
//     this.body = body;
//   }
// }
// // 블록.헤더 구조 정의
// class BlockHeader {
//   constructor(
//     index,
//     previousHash,
//     timestamp,
//     merkleRoot,
//     difficulty,
//     nonce,
//     version
//   ) {
//     this.index = index;
//     this.previousHash = previousHash;
//     this.timestamp = timestamp;
//     this.merkleRoot = merkleRoot;
//     this.hash = hash;
//     this.difficulty = difficulty;
//     this.nonce = nonce;
//     this.version = version;
//   }
// }
// // 블록.바디 구조 정의
// class BlockBody {
//   constructor(transactions) {
//     this.transactions = [transactions];
//   }
// }

// 블록 구조 정의
class Block {
  constructor(index, hash, previousHash, timestamp, data, difficulty, nonce) {
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.hash = hash;
    this.difficulty = difficulty;
    this.nonce = nonce;
  }
}

// 제네시스 트랜잭션
const genesisTransaction = {
  txIns: [{ signature: "", txOutId: "", txOutIndex: 0 }],
  txOuts: [
    {
      address:
        "04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534a",
      amount: 50,
    },
  ],
  id: "e655f6a5f26dc9b4cac6e46f52336428287759cf81ef5ff10854f69d68f43fa3",
};
// 제네시스 블록
const genesisBlock = new Block(
  0,
  "91a73664bc84c0baa1fc75ea6e4aa6d1d20c5df664c724e3159aefc2e1186627",
  "",
  1465154705,
  [genesisTransaction],
  0,
  0
);

// 블록체인 초기(제네시스블록)
let blockchain = [genesisBlock];

// 미사용 트랜잭션 아웃풋 목록(공용장부).
// 초기 상태는 제네시스 블록에서 나온 미사용 트랜잭션
let unspentTxOuts = TX.processTransactions(blockchain[0].data, [], 0);

// 내 블록체인 가져오기
const getBlockchain = () => blockchain;

// 내 공용장부 가져오기
const getUnspentTxOuts = () => _.cloneDeep(unspentTxOuts);

// 새로만들거나 받은 미사용 트랜잭션 목록(공용장부)로  교체
const setUnspentTxOuts = (newUnspentTxOut) => {
  unspentTxOuts = newUnspentTxOut;
  console.log("공용장부(unspentTxouts)를 최신화합니다");
};

// 내 마지막 블록 가져오기
const getLatestBlock = () => blockchain[blockchain.length - 1];

// 블록생성 간격 10초
const BLOCK_GENERATION_INTERVAL = 10;

// 난이도 조정 간격 블록 5개당
const DIFFICULTY_ADJUSTMENT_INTERVAL = 5;

// 나니도 가져오기
const getDifficulty = (aBlockchain) => {
  // 마지막 블록 = 블록체인의 길이에서 1을 뺀 인덱스값(길이는 1, 배열 접근하는 인덱스는 0으로 시작하니까)
  const latestBlock = aBlockchain[blockchain.length - 1];
  // 마지막 블록의 인덱스를 난이도 조정 간격인 5로 나눠떨어지면서 &&
  // 마지막 블록이 제네시스 블록이 아닌 경우(결론 블록 5개마다)
  if (
    latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 &&
    latestBlock.index !== 0
  ) {
    if (latestBlock.difficulty == 0) {
      return latestBlock.difficulty;
    }
    // 난이도를 조정해서 반환하기
    return getAdjustedDifficulty(latestBlock, aBlockchain);
    // 블록 1~4개까지는 마지막 블록과 동일한 난이도로 유지
  } else {
    return latestBlock.difficulty;
  }
};

// (마지막 블록이랑 5개 이전 블록 비교하여) 난이도 조정
const getAdjustedDifficulty = (latestBlock, aBlockchain) => {
  // 난이도 조정 1회만큼 이전 블록 (마지막 블록에서 조정간격인 5개 전 블록을 통해 알수있음)
  const prevAdjustmentBlock =
    aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
  // 예상시간 (난이도 조정을 어떻게 할지 기준점이 되는 시간 50초)
  const timeExpected =
    BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
  // 소요시간 (마지막 블록과 5개 이전 블록의 시간차로 구함)
  const timeTaken = latestBlock.timestamp - prevAdjustmentBlock.timestamp;

  // 블록 5개가 새로 채굴될 동안 흐른 시간이 25초 미만이면 난이도 1증가
  if (timeTaken < timeExpected / 2) {
    return prevAdjustmentBlock.difficulty + 1;
    // 블록 5개가 새로 채굴될 동안 흐른 시간이 100초 초과이면 난이도 1감소
  } else if (timeTaken > timeExpected * 2) {
    return prevAdjustmentBlock.difficulty - 1;
    // 블록5개 채굴시간이 25~100초 사이이면 난이도 냅두기
  } else {
    return prevAdjustmentBlock.difficulty;
  }
};

// 현재시간을 타임스탬프 형식으로
const getCurrentTimestamp = () => Math.round(new Date().getTime() / 1000);

// 새 블록 생성
const generateRawNextBlock = (blockData) => {
  const previousBlock = getLatestBlock(); // 마지막 블록
  // 현재 블록체인을 통해 난이도 가져오기
  const difficulty = getDifficulty(getBlockchain());
  // 새 블록의 인덱스는 마지막 블록 인덱스보다 1 큼
  const nextIndex = previousBlock.index + 1;
  // 현재 시간을 새 블록의 타임스탬프로
  const nextTimestamp = getCurrentTimestamp();
  // 위 내용들과 블록에 들어갈 코인베이스, 트랜잭션들을 가지고
  // 알맞는 해시값 찾아 채굴하기
  const newBlock = findBlock(
    nextIndex,
    previousBlock.hash,
    nextTimestamp,
    blockData,
    difficulty
  );
  // 블록체인에 채굴한 블록 추가하고 그 블록 전파하기
  if (addBlockToChain(newBlock)) {
    P2P.broadcastLatest();
    return newBlock;
  } else {
    return null;
  }
};

// 내 지갑에 해당하는 미사용 트랜잭션 찾아서 불러오기
// 공용장부에서 내 공개키와 일치하는 정보만 반환
const getMyUnspentTransactionOutputs = () => {
  return WALLET.findUnspentTxOuts(
    WALLET.getPublicFromWallet(),
    getUnspentTxOuts()
  );
};

// 새 블록 생성
const generateNextBlock = () => {
  // 내가 채굴했으니 내 지갑 공개키 담은 코인베이스 트랜잭션 생성
  const coinbaseTx = TX.getCoinbaseTransaction(
    WALLET.getPublicFromWallet(),
    // 아직 블록 추가하기 전 단계이므로 새블록의 인덱스를 넣기위해 마지막블록의 인덱스+1
    getLatestBlock().index + 1
  );
  // 코인베이스 트랜잭션[]이랑 그동안 생긴 트랜잭션[]이랑
  // concat으로 뚝딱 합쳐서 새 블록 생성하자
  const blockData = [coinbaseTx].concat(TP.getTransactionPool());
  return generateRawNextBlock(blockData);
};

// 블록 생성하면서 내 트랜잭션도 끼워넣기 (사용 안함)
// (코인베이스트랜잭션과 풀 사이에 채굴자가 임의로 만든 트랜잭션 끼워넣는것)
const generatenextBlockWithTransaction = (receiverAddress, amount) => {
  if (!TX.isValidAddress(receiverAddress)) {
    throw Error("주소가 잘못되었어요");
  }
  if (typeof amount !== "number") {
    throw Error("코인의 type이 number가 아니에요");
  }
  // 코인베이스 트랜잭션 만들기
  const coinbaseTx = TX.getCoinbaseTransaction(
    WALLET.getPublicFromWallet(),
    getLatestBlock().index + 1
  );
  // 트랜잭션 만들기
  const tx = WALLET.createTransaction(
    receiverAddress,
    amount,
    WALLET.getPrivateFromWallet(),
    getUnspentTxOuts(),
    TP.getTransactionPool()
  );

  const blockData = [coinbaseTx, tx];
  return generateRawNextBlock(blockData);
};

// 블록 찾기(채굴)
const findBlock = (index, previousHash, timestamp, data, difficulty) => {
  let nonce = 0; // 해시를 계산해서 난이도와 알맞는 해시가 될때까지
  while (true) {
    // nonce를 증가시키며 반복할것임
    const hash = calculateHash(
      index,
      previousHash,
      timestamp,
      data,
      difficulty,
      nonce
    ); // 난이도와 부합하는 해시가 나왔으면 블록으로 반환
    if (hashMatchesDifficulty(hash, difficulty)) {
      return new Block(
        index,
        hash,
        previousHash,
        timestamp,
        data,
        difficulty,
        nonce
      );
    }
    nonce++;
  }
};

// 내 지갑 잔고 조회
const getAccountBalance = () => {
  // 미사용 트랜잭션(getUnspentTxOuts)에서
  // 내 지갑(getPublicFromWallet)에 해당하는 녀석 찾아옴
  return WALLET.getBalance(WALLET.getPublicFromWallet(), getUnspentTxOuts());
};

// 트랜잭션 보내기 (내가 누군가에게 코인 보내는 것)
const sendTransaction = (address, amount) => {
  // 트랜잭션 만들어서 <- (누군가의 주소, 코인양, 내지갑주소, 공용장부, 내트랜잭션풀)
  const tx = WALLET.createTransaction(
    address, // 내가 A한테 amount만큼 보낼거임 address는 A의 주소
    amount, // 코인양
    WALLET.getPrivateFromWallet(), // 코인 꺼낼 내 지갑주소
    getUnspentTxOuts(), // 공용장부 불러오기
    TP.getTransactionPool() // 트랜잭션풀 불러오기
  );
  // 트랜잭션풀에 쑤셔넣고
  TP.addToTransactionPool(tx, getUnspentTxOuts());
  // 그 트랜잭션풀 방방곡곡 소문내기
  P2P.broadCastTransactionPool();
  console.log("트랜잭션을 소문낼게요");
  return tx;
};

// 받은 블록 해시 계산하기
const calculateHashForBlock = (block) =>
  calculateHash(
    block.index,
    block.previousHash,
    block.timestamp,
    block.data,
    block.difficulty,
    block.nonce
  );

// 해시 계산
const calculateHash = (
  index,
  previousHash,
  timestamp,
  data,
  difficulty,
  nonce
) =>
  CryptoJS.SHA256(
    index + previousHash + timestamp + data + difficulty + nonce
  ).toString();

// 블록구조 검사
const isValidBlockStructure = (block) => {
  return (
    typeof block.index === "number" &&
    typeof block.hash === "string" &&
    typeof block.previousHash === "string" &&
    typeof block.timestamp === "number" &&
    typeof block.data === "object"
  );
};

// 이전블록과 비교해서 알맞은 블록인지 검증
// (새 블록 추가할 때(addBlockToChain), 블록체인 교체할 때(replaceChain) 사용됨)
const isValidNewBlock = (newBlock, previousBlock) => {
  if (!isValidBlockStructure(newBlock)) {
    console.log(
      "블록검증실패: 블록 구조가 잘못됐어요",
      JSON.stringify(newBlock)
    );
    return false;
  }
  if (previousBlock.index + 1 !== newBlock.index) {
    console.log("블록검증실패: 인덱스가 잘못됐어요");
    return false;
  } else if (previousBlock.hash !== newBlock.previousHash) {
    console.log("블록검증실패: 이전블록의 해시와 새블록의 해시가 달라요");
    return false;
  } else if (!isValidTimestamp(newBlock, previousBlock)) {
    console.log("블록검증실패: 타임스탬프가 잘못됐어요");
    return false;
  } else if (!hasValidHash(newBlock)) {
    console.log("블록검증실패: 해시가 잘못됐어요");
    return false;
  }
  return true;
};

// 누적 난이도 계산해주는 녀석
const getAccumulatedDifficulty = (aBlockchain) => {
  return aBlockchain
    .map((block) => block.difficulty)
    .map((difficulty) => Math.pow(2, difficulty))
    .reduce((a, b) => a + b);
};

// 타임스탬프 검증하기
const isValidTimestamp = (newBlock, previousBlock) => {
  return (
    // 이전블록 타임스탬프-60초 보다 새블록 타임스탬프가 크고 &&
    // 새블록 타임스탬프-60초 보다 현재시간이 크면 허용
    previousBlock.timestamp - 60 < newBlock.timestamp &&
    newBlock.timestamp - 60 < getCurrentTimestamp()
  );
  // 이전블록보다 새블록이 60초까진 일찍 나와도 네트워크시간 오차로 허용하고
  // 새블록이 내 시간보다 60초까진 일찍 나와도 네트워크시간 오차로 허용한다는 의미일듯
};

// 해시 검증하기
const hasValidHash = (block) => {
  // 블록의 해시와 블록의 데이터들로 계산해본 해시가 다르면
  if (!hashMatchesBlockContent(block)) {
    console.log("블록에 입력된 해시가 실제 해시와 달라요");
    return false;
  }
  // 해시가 난이도에 맞게 0이 들어가지 않은 경우
  if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
    console.log("해시가 난이도와 매칭이 안되네요");
  }
  return true;
};

// 블록에 들어있는 해시랑 계산해본 해시랑 일치하는지 검사
const hashMatchesBlockContent = (block) => {
  const blockHash = calculateHashForBlock(block);
  return blockHash === block.hash;
};

// 찾은 해시값이 난이도에 맞는 해시값인지 검사
// 찾은 해시값을 2진수로 변환해 난이도만큼 앞에 0으로 채워졌는지 대조하기
const hashMatchesDifficulty = (hash, difficulty) => {
  const hashInBinary = hexToBinary(hash);
  const requiredPrefix = "0".repeat(difficulty);
  return hashInBinary.startsWith(requiredPrefix);
};

// 전달받은 블록체인과 그 안의 트랜잭션들을 검증하고 그로부터 만들어낸 공용장부 반환받기
const isValidChain = (blockchainToValidate) => {
  // 내 제네시스 블록과 전달받은 블록체인의 제네시스 블록이 같으면 true
  const isValidGenesis = (block) => {
    return JSON.stringify(block) === JSON.stringify(genesisBlock);
  };
  // 전달받은 블록체인과 내 제네시스 블록 동일한지 검증
  if (!isValidGenesis(blockchainToValidate[0])) {
    return null;
  }

  // 새로 만들 공용장부
  let aUnspentTxOuts = [];

  // 전달받은 블록체인 길이만큼 돌리기
  for (let i = 0; i < blockchainToValidate.length; i++) {
    const currentBlock = blockchainToValidate[i];
    if (
      // 블록들 하나하나 순서대로 정상인지 검사
      i !== 0 &&
      !isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])
    ) {
      return null;
    }
    // 전달받은 블록들의 트랜잭션들 검사해서 공용장부 갱신
    aUnspentTxOuts = TX.processTransactions(
      currentBlock.data,
      aUnspentTxOuts,
      currentBlock.index
    );
    // 공용장부에 들은게 null이면
    if (aUnspentTxOuts === null) {
      console.log("블록체인 안에 거래정보(트랜잭션)가 잘못되었네요");
      return null;
    }
  }

  // 전달받은 블록체인으로 만든 공용장부 반환
  // (체인교체할 때 공용장부도 이 새로만든 공용장부로 바꿀것임)
  return aUnspentTxOuts;
};

// 새 블록 블록체인에 추가하기
const addBlockToChain = (newBlock) => {
  // 새 블록 검증해서 정상이면
  if (isValidNewBlock(newBlock, getLatestBlock())) {
    // (processTransactions)새 블록에 들어갈 트랜잭션들 검증하고
    // 기존 미사용트랜잭션아웃풋목록(uTxOs/공용장부)에서 새 블록에 담긴 거래들과
    // 현재 공용장부 정산해서 갱신한 공용장부 retVal변수에 담기
    const retVal = TX.processTransactions(
      newBlock.data,
      getUnspentTxOuts(),
      newBlock.index
    );
    // 새블록에 들어갈 공용장부가 null 이면
    if (retVal === null) {
      console.log("블록 추가하려고 했는데 트랜잭션쪽에 뭔가 문제가 있어요");
      return false;
      // 이상 없으면 블록체인에 새블록 추가하고
      // 내가 가진 기존 공용장부 갱신한 공용장부로 최신화
      // 최신화된 공용장부로 트랜잭션풀 갱신
    } else {
      blockchain.push(newBlock);
      setUnspentTxOuts(retVal);
      TP.updateTransactionPool(unspentTxOuts);
      return true;
    }
  }
  return false;
};

// 블록체인 교체하기
const replaceChain = (newBlocks) => {
  // 전달받은 블록체인, 그안의 트랜잭션들 검증 후
  // 그것들로 만든 공용장부를 aUnspentTxOuts변수에 저장
  const aUnspentTxOuts = isValidChain(newBlocks);

  // 공용장부 상태가 null 이 아닌지 확인용 변수validChain (true/false)
  const validChain = aUnspentTxOuts !== null;

  // 공용장부가 비어있지 않고 && 전달받은 블록체인의 누적난이도가
  // 내가 가진 블록체인의 누적난이도보다 높으면
  if (
    validChain &&
    getAccumulatedDifficulty(newBlocks) >
      getAccumulatedDifficulty(getBlockchain())
  ) {
    console.log("전달받은 블록체인으로 교체했어요!");
    // 내 블록체인을 전달받은 블록체인으로 샤샥 교체
    // 공용장부도 전달받은 블록체인으로부터 만든 공용장부로 교체
    // 새 공용장부로 트랜잭션풀 갱신
    // 최신화된 블록체인의 마지막 블록 소문내기
    blockchain = newBlocks;
    setUnspentTxOuts(aUnspentTxOuts);
    TP.updateTransactionPool(unspentTxOuts);
    P2P.broadcastLatest();
  } else {
    console.log(
      "전달받은 블록체인보다 내 블록체인의 누적 난이도가 높으니 내 블록체인을 그대로 유지합니다"
    );
  }
};
// 받은 트랜잭션풀에서 트랜잭션 하나씩 검증해서 내 트랜잭션풀에 넣기
const handleReceivedTransaction = (transaction) => {
  TP.addToTransactionPool(transaction, getUnspentTxOuts());
};

module.exports = {
  Block,
  getBlockchain,
  getUnspentTxOuts,
  getLatestBlock,
  sendTransaction,
  generateRawNextBlock,
  generateNextBlock,
  generatenextBlockWithTransaction,
  handleReceivedTransaction,
  getMyUnspentTransactionOutputs,
  getAccountBalance,
  isValidBlockStructure,
  replaceChain,
  addBlockToChain,
};
