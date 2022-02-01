const CryptoJS = require("crypto-js");
const ecdsa = require("elliptic");
const _ = require("lodash");

const EC = new ecdsa.ec("secp256k1");

const COINBASE_AMOUNT = 50;

class UnspentTxOut {
  constructor(txOutId, txOutIndex, address, amount) {
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.address = address;
    this.amount = amount;
  }
}

class TxIn {
  constructor(txOutId, txOutIndex, signature) {
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.signature = signature;
  }
}

class TxOut {
  constructor(address, amount) {
    this.address = address;
    this.amount = amount;
  }
}

class Transaction {
  constructor(id, txIns, txOuts) {
    this.id = id;

    this.txIns = txIns;
    this.txOuts = txOuts;
  }
}

const getTransactionId = (transaction) => {
  const txInContent = transaction.txIns
    .map((txIn) => txIn.txOutId + txIn.txOutIndex)
    .reduce((a, b) => a + b, "");

  const txOutContent = transaction.txOuts
    .map((txOut) => txOut.address + txOut.amount)
    .reduce((a, b) => a + b, "");

  return CryptoJS.SHA256(txInContent + txOutContent).toString();
};

// 트랜잭션 확인
const validateTransaction = (transaction, aUnspentTxOuts) => {
  // 트랜잭션 구조 검증하고
  if (!isValidTransactionStructure(transaction)) {
    return false;
  }
  //
  if (getTransactionId(transaction) !== transaction.id) {
    console.log("invalid tx id: " + transaction.id);
    return false;
  }
  const hasValidTxIns = transaction.txIns
    .map((txIn) => validateTxIn(txIn, transaction, aUnspentTxOuts))
    .reduce((a, b) => a && b, true);

  if (!hasValidTxIns) {
    console.log("some of the txIns are invalid in tx: " + transaction.id);
    return false;
  }

  const totalTxInValues = transaction.txIns
    .map((txIn) => getTxInAmount(txIn, aUnspentTxOuts))
    .reduce((a, b) => a + b, 0);

  const totalTxOutValues = transaction.txOuts
    .map((txOut) => txOut.amount)
    .reduce((a, b) => a + b, 0);

  if (totalTxOutValues !== totalTxInValues) {
    console.log(
      "totalTxOutValues !== totalTxInValues in tx: " + transaction.id
    );
    return false;
  }

  return true;
};

// 블록
const validateBlockTransactions = (
  aTransactions,
  aUnspentTxOuts,
  blockIndex
) => {
  const coinbaseTx = aTransactions[0];
  if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
    console.log("invalid coinbase transaction: " + JSON.stringify(coinbaseTx));
    return false;
  }

  // check for duplicate txIns. Each txIn can be included only once
  const txIns = _(aTransactions)
    .map((tx) => tx.txIns)
    .flatten() // 배열 안의 배열을 풀어주는 녀석 -> [[a],[b],[c]] -> [a,b,c]
    .value();

  if (hasDuplicates(txIns)) {
    return false;
  }

  // 일반 트랜잭션들(코인베이스 트랜잭션을 제외한 전체 트랜잭션)
  const normalTransactions = aTransactions.slice(1);
  // 일반 트랜잭션들을 검사해서 모두 정상이면 true 반환
  return normalTransactions
    .map((tx) => validateTransaction(tx, aUnspentTxOuts))
    .reduce((a, b) => a && b, true);
};

const hasDuplicates = (txIns) => {
  const groups = _.countBy(txIns, (txIn) => txIn.txOutId + txIn.txOutIndex);
  return _(groups)
    .map((value, key) => {
      if (value > 1) {
        console.log("duplicate txIn: " + key);
        return true;
      } else {
        return false;
      }
    })
    .includes(true);
};

const validateCoinbaseTx = (transaction, blockIndex) => {
  if (transaction == null) {
    console.log(
      "the first transaction in the block must be coinbase transaction"
    );
    return false;
  }
  if (getTransactionId(transaction) !== transaction.id) {
    console.log("invalid coinbase tx id: " + transaction.id);
    return false;
  }
  if (transaction.txIns.length !== 1) {
    console.log("one txIn must be specified in the coinbase transaction");
    return;
  }
  if (transaction.txIns[0].txOutIndex !== blockIndex) {
    console.log("the txIn signature in coinbase tx must be the block height");
    return false;
  }
  if (transaction.txOuts.length !== 1) {
    console.log("invalid number of txOuts in coinbase transaction");
    return false;
  }
  if (transaction.txOuts[0].amount !== COINBASE_AMOUNT) {
    console.log("invalid coinbase amount in coinbase transaction");
    return false;
  }
  return true;
};

const validateTxIn = (txIn, transaction, aUnspentTxOuts) => {
  const referencedUTxOut = aUnspentTxOuts.find(
    (uTxO) =>
      uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex
  );
  if (referencedUTxOut == null) {
    console.log("referenced txOut not found: " + JSON.stringify(txIn));
    return false;
  }
  const address = referencedUTxOut.address;

  const key = EC.keyFromPublic(address, "hex");
  const validSignature = key.verify(transaction.id, txIn.signature);
  if (!validSignature) {
    console.log(
      "invalid txIn signature: %s txId: %s address: %s",
      txIn.signature,
      transaction.id,
      referencedUTxOut.address
    );
    return false;
  }
  return true;
};

const getTxInAmount = (txIn, aUnspentTxOuts) => {
  return findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts).amount;
};

const findUnspentTxOut = (transactionId, index, aUnspentTxOuts) => {
  return aUnspentTxOuts.find(
    (uTxO) => uTxO.txOutId === transactionId && uTxO.txOutIndex === index
  );
};
// 코인베이스 트랜잭션 만들어주기
const getCoinbaseTransaction = (address, blockIndex) => {
  const t = new Transaction();
  const txIn = new TxIn();
  // 코인베이스는 시그니쳐(서명)없음
  txIn.signature = "";
  // id 도 없음
  txIn.txOutId = "";
  txIn.txOutIndex = blockIndex;

  t.txIns = [txIn];
  t.txOuts = [new TxOut(address, COINBASE_AMOUNT)];
  t.id = getTransactionId(t);
  return t;
};

const signTxIn = (transaction, txInIndex, privateKey, aUnspentTxOuts) => {
  const txIn = transaction.txIns[txInIndex];

  const dataToSign = transaction.id;
  const referencedUnspentTxOut = findUnspentTxOut(
    txIn.txOutId,
    txIn.txOutIndex,
    aUnspentTxOuts
  );
  if (referencedUnspentTxOut == null) {
    console.log("could not find referenced txOut");
    throw Error();
  }
  const referencedAddress = referencedUnspentTxOut.address;

  if (getPublicKey(privateKey) !== referencedAddress) {
    console.log(
      "trying to sign an input with private" +
        " key that does not match the address that is referenced in txIn"
    );
    throw Error();
  }
  const key = EC.keyFromPrivate(privateKey, "hex");
  const signature = toHexString(key.sign(dataToSign).toDER());

  return signature;
};

const updateUnspentTxOuts = (aTransactions, aUnspentTxOuts) => {
  const newUnspentTxOuts = aTransactions
    .map((t) => {
      return t.txOuts.map(
        (txOut, index) =>
          new UnspentTxOut(t.id, index, txOut.address, txOut.amount)
      );
    })
    .reduce((a, b) => a.concat(b), []);

  const consumedTxOuts = aTransactions
    .map((t) => t.txIns)
    .reduce((a, b) => a.concat(b), [])
    .map((txIn) => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, "", 0));

  const resultingUnspentTxOuts = aUnspentTxOuts
    .filter(
      (uTxO) => !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts)
    )
    .concat(newUnspentTxOuts);

  return resultingUnspentTxOuts;
};

// 트랜잭션
const processTransactions = (aTransactions, aUnspentTxOuts, blockIndex) => {
  if (!validateBlockTransactions(aTransactions, aUnspentTxOuts, blockIndex)) {
    console.log("invalid block transactions");
    return null;
  }
  return updateUnspentTxOuts(aTransactions, aUnspentTxOuts);
};

const toHexString = (byteArray) => {
  return Array.from(byteArray, (byte) => {
    return ("0" + (byte & 0xff).toString(16)).slice(-2);
  }).join("");
};

const getPublicKey = (aPrivateKey) => {
  return EC.keyFromPrivate(aPrivateKey, "hex").getPublic().encode("hex");
};

// 트랜잭션의 인풋 구조 검증
const isValidTxInStructure = (txIn) => {
  if (txIn == null) {
    console.log("(검증실패) 트랜잭션의 인풋이 null 입니다");
    return false;
  } else if (typeof txIn.signature !== "string") {
    console.log("(검증실패) 트랜잭션의 인풋의 서명이 string이 아니네요");
    return false;
  } else if (typeof txIn.txOutId !== "string") {
    console.log("(검증실패) 트랜잭션의 인풋의 txOutId가 string이 아니네요");
    return false;
  } else if (typeof txIn.txOutIndex !== "number") {
    console.log("(검증실패) 트랜잭션의 인풋의 txOutIndex가 number가 아니네요");
    return false;
  } else {
    return true;
  }
};

// 트랜잭션의 아웃풋 구조 검증
const isValidTxOutStructure = (txOut) => {
  if (txOut == null) {
    console.log("(검증실패) 트랜잭션의 아웃풋이 null 입니다");
    return false;
  } else if (typeof txOut.address !== "string") {
    console.log("(검증실패) 트랜잭션의 아웃풋의 주소가 string이 아니네요");
    return false;
  } else if (!isValidAddress(txOut.address)) {
    console.log("(검증실패) 트랜잭션의 아웃풋의 주소가 잘못됐어요");
    return false;
  } else if (typeof txOut.amount !== "number") {
    console.log("(검증실패) 트랜잭션의 아웃풋의 코인이 number가 아니에요");
    return false;
  } else {
    return true;
  }
};

// 트랜잭션 구조 검증
const isValidTransactionStructure = (transaction) => {
  if (typeof transaction.id !== "string") {
    console.log("(검증실패) 트랜잭션 id가 문자열이 아닙니다");
    return false;
  }
  if (!(transaction.txIns instanceof Array)) {
    console.log("(검증실패) 트랜잭션의 txIns가 배열이 아닙니다");
    return false;
  }
  if (
    // 트랜잭션의 txIns에 들어있는 인풋들 구조 검사
    !transaction.txIns.map(isValidTxInStructure).reduce((a, b) => a && b, true)
  ) {
    return false;
  }
  if (!(transaction.txOuts instanceof Array)) {
    console.log("(검증실패) 트랜잭션의 txOuts가 배열이 아닙니다");
    return false;
  }
  if (
    // 트랜잭션의 txOuts에 들어있는 아웃풋들 구조 검사
    !transaction.txOuts
      .map(isValidTxOutStructure)
      .reduce((a, b) => a && b, true)
  ) {
    return false;
  }
  return true;
};

// 지갑 공개키 검증
const isValidAddress = (address) => {
  // 공개키가 130자가 아니면
  if (address.length !== 130) {
    console.log("공개키가 130자가 아니네요");
    return false;
  } else if (address.match("^[a-fA-F0-9]+$") === null) {
    console.log("공개키가 16진수가 아니네요");
    return false;
  } else if (!address.startsWith("04")) {
    console.log("공개키가 '04'로 시작하지 않네요");
    return false;
  }
  return true;
};

module.exports = {
  processTransactions,
  signTxIn,
  getTransactionId,
  isValidAddress,
  validateTransaction,
  UnspentTxOut,
  TxIn,
  TxOut,
  getCoinbaseTransaction,
  getPublicKey,
  hasDuplicates,
  Transaction,
};
