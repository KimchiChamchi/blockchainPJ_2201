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

let blockchain = [genesisBlock];

// 미사용 트랜잭션 아웃풋 목록. 초기 상태는 제네시스 블록에서 나온 미사용 트랜잭션
let unspentTxOuts = TX.processTransactions(blockchain[0].data, [], 0);

const getBlockchain = () => blockchain;

const getUnspentTxOuts = () => _.cloneDeep(unspentTxOuts);

// 미사용 트랜잭션 목록 교체
const setUnspentTxOuts = (newUnspentTxOut) => {
  console.log("unspentTxouts를 교체합니다");
  unspentTxOuts = newUnspentTxOut;
};

const getLatestBlock = () => blockchain[blockchain.length - 1];

// 블록생성 간격 10초
const BLOCK_GENERATION_INTERVAL = 10;

// 난이도 조절 간격 블록 5개당
const DIFFICULTY_ADJUSTMENT_INTERVAL = 5;

const getDifficulty = (aBlockchain) => {
  const latestBlock = aBlockchain[blockchain.length - 1];
  if (
    latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 &&
    latestBlock.index !== 0
  ) {
    return getAdjustedDifficulty(latestBlock, aBlockchain);
  } else {
    return latestBlock.difficulty;
  }
};

// (마지막 블록이랑 5개 이전 블록 비교하여) 난이도 조절
const getAdjustedDifficulty = (latestBlock, aBlockchain) => {
  const prevAdjustmentBlock =
    aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
  const timeExpected =
    BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
  const timeTaken = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
  if (timeTaken < timeExpected / 2) {
    return prevAdjustmentBlock.difficulty + 1;
  } else if (timeTaken > timeExpected * 2) {
    return prevAdjustmentBlock.difficulty - 1;
  } else {
    return prevAdjustmentBlock.difficulty;
  }
};

// 현재시간을 타임스탬프로
const getCurrentTimestamp = () => Math.round(new Date().getTime() / 1000);

// 새 블록 생성
const generateRawNextBlock = (blockData) => {
  const previousBlock = getLatestBlock();
  const difficulty = getDifficulty(getBlockchain());
  const nextIndex = previousBlock.index + 1;
  const nextTimestamp = getCurrentTimestamp();
  const newBlock = findBlock(
    nextIndex,
    previousBlock.hash,
    nextTimestamp,
    blockData,
    difficulty
  );
  // 블록체인에 채굴한 블록 추가하고 채굴한 블록 전파하기
  if (addBlockToChain(newBlock)) {
    P2P.broadcastLatest();
    return newBlock;
  } else {
    return null;
  }
};

// 내 지갑에 해당하는 미사용 트랜잭션 찾아서 불러오기
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
    getLatestBlock().index + 1
  );
  // 코인베이스 트랜잭션이랑 그동안 생긴 트랜잭션 담아서 새 블록 생성
  const blockData = [coinbaseTx].concat(TP.getTransactionPool());
  return generateRawNextBlock(blockData);
};

//
const generatenextBlockWithTransaction = (receiverAddress, amount) => {
  if (!TX.isValidAddress(receiverAddress)) {
    throw Error("주소가 잘못되었어요");
  }
  if (typeof amount !== "number") {
    throw Error("코인의 type이 number가 아니에요");
  }
  const coinbaseTx = TX.getCoinbaseTransaction(
    WALLET.getPublicFromWallet(),
    getLatestBlock().index + 1
  );
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

const findBlock = (index, previousHash, timestamp, data, difficulty) => {
  let nonce = 0;
  while (true) {
    const hash = calculateHash(
      index,
      previousHash,
      timestamp,
      data,
      difficulty,
      nonce
    );
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

const sendTransaction = (address, amount) => {
  const tx = createTransaction(
    address,
    amount,
    WALLET.getPrivateFromWallet(),
    getUnspentTxOuts(),
    TP.getTransactionPool()
  );
  TP.addToTransactionPool(tx, getUnspentTxOuts());
  P2P.broadCastTransactionPool();
  return tx;
};

const calculateHashForBlock = (block) =>
  calculateHash(
    block.index,
    block.previousHash,
    block.timestamp,
    block.data,
    block.difficulty,
    block.nonce
  );

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

const isValidBlockStructure = (block) => {
  return (
    typeof block.index === "number" &&
    typeof block.hash === "string" &&
    typeof block.previousHash === "string" &&
    typeof block.timestamp === "number" &&
    typeof block.data === "object"
  );
};

const isValidNewBlock = (newBlock, previousBlock) => {
  if (!isValidBlockStructure(newBlock)) {
    console.log("invalid block structure: %s", JSON.stringify(newBlock));
    return false;
  }
  if (previousBlock.index + 1 !== newBlock.index) {
    console.log("invalid index");
    return false;
  } else if (previousBlock.hash !== newBlock.previousHash) {
    console.log("invalid previoushash");
    return false;
  } else if (!isValidTimestamp(newBlock, previousBlock)) {
    console.log("invalid timestamp");
    return false;
  } else if (!hasValidHash(newBlock)) {
    return false;
  }
  return true;
};

const getAccumulatedDifficulty = (aBlockchain) => {
  return aBlockchain
    .map((block) => block.difficulty)
    .map((difficulty) => Math.pow(2, difficulty))
    .reduce((a, b) => a + b);
};

const isValidTimestamp = (newBlock, previousBlock) => {
  return (
    previousBlock.timestamp - 60 < newBlock.timestamp &&
    newBlock.timestamp - 60 < getCurrentTimestamp()
  );
};

const hasValidHash = (block) => {
  if (!hashMatchesBlockContent(block)) {
    console.log("invalid hash, got:" + block.hash);
    return false;
  }

  if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
    console.log(
      "block difficulty not satisfied. Expected: " +
        block.difficulty +
        "got: " +
        block.hash
    );
  }
  return true;
};

const hashMatchesBlockContent = (block) => {
  const blockHash = calculateHashForBlock(block);
  return blockHash === block.hash;
};

const hashMatchesDifficulty = (hash, difficulty) => {
  const hashInBinary = hexToBinary(hash);
  const requiredPrefix = "0".repeat(difficulty);
  return hashInBinary.startsWith(requiredPrefix);
};

/*
    Checks if the given blockchain is valid. Return the unspent txOuts if the chain is valid
 */
const isValidChain = (blockchainToValidate) => {
  console.log("isValidChain:");
  console.log(JSON.stringify(blockchainToValidate));
  const isValidGenesis = (block) => {
    return JSON.stringify(block) === JSON.stringify(genesisBlock);
  };

  if (!isValidGenesis(blockchainToValidate[0])) {
    return null;
  }
  /*
    Validate each block in the chain. The block is valid if the block structure is valid
      and the transaction are valid
     */
  let aUnspentTxOuts = [];

  for (let i = 0; i < blockchainToValidate.length; i++) {
    const currentBlock = blockchainToValidate[i];
    if (
      i !== 0 &&
      !isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])
    ) {
      return null;
    }

    aUnspentTxOuts = TX.processTransactions(
      currentBlock.data,
      aUnspentTxOuts,
      currentBlock.index
    );
    if (aUnspentTxOuts === null) {
      console.log("invalid transactions in blockchain");
      return null;
    }
  }
  return aUnspentTxOuts;
};

const addBlockToChain = (newBlock) => {
  if (isValidNewBlock(newBlock, getLatestBlock())) {
    const retVal = TX.processTransactions(
      newBlock.data,
      getUnspentTxOuts(),
      newBlock.index
    );
    if (retVal === null) {
      console.log("block is not valid in terms of transactions");
      return false;
    } else {
      blockchain.push(newBlock);
      setUnspentTxOuts(retVal);
      TP.updateTransactionPool(unspentTxOuts);
      return true;
    }
  }
  return false;
};

const replaceChain = (newBlocks) => {
  const aUnspentTxOuts = isValidChain(newBlocks);
  const validChain = aUnspentTxOuts !== null;
  if (
    validChain &&
    getAccumulatedDifficulty(newBlocks) >
      getAccumulatedDifficulty(getBlockchain())
  ) {
    console.log(
      "Received blockchain is valid. Replacing current blockchain with received blockchain"
    );
    blockchain = newBlocks;
    setUnspentTxOuts(aUnspentTxOuts);
    TP.updateTransactionPool(unspentTxOuts);
    P2P.broadcastLatest();
  } else {
    console.log("Received blockchain invalid");
  }
};

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
