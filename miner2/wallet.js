const ecdsa = require("elliptic");
const fs = require("fs");
const _ = require("lodash");
const TX = require("./transaction");

const EC = new ecdsa.ec("secp256k1");
const privateKeyLocation =
  process.env.PRIVATE_KEY || "miner3/wallet/private_key";

// 지갑에서 비밀키 가져오기
const getPrivateFromWallet = () => {
  const buffer = fs.readFileSync(privateKeyLocation, "utf8");
  return buffer.toString();
};

// 지갑에서 공개키 가져오기
const getPublicFromWallet = () => {
  const privateKey = getPrivateFromWallet();
  const key = EC.keyFromPrivate(privateKey, "hex");
  return key.getPublic().encode("hex");
};

// 비밀키 생성
const generatePrivateKey = () => {
  const keyPair = EC.genKeyPair();
  const privateKey = keyPair.getPrivate();
  return privateKey.toString(16);
};

// 지갑 초기화
const initWallet = () => {
  // 지갑이 이미 있으면 아무것도 안하기
  if (fs.existsSync(privateKeyLocation)) {
    return;
  }
  // 지갑 생성
  const newPrivateKey = generatePrivateKey();
  // 지갑 경로 생성
  fs.writeFileSync(privateKeyLocation, newPrivateKey);
  console.log(
    "new wallet with private key created to : %s",
    privateKeyLocation
  );
};

// 지갑 삭제
const deleteWallet = () => {
  if (fs.existsSync(privateKeyLocation)) {
    fs.unlinkSync(privateKeyLocation);
  }
};

// 지갑 잔고 조회
const getBalance = (address, unspentTxOuts) => {
  // 미사용 트랜잭션에서 해당 지갑주소만 찾아서 합치기
  return _(findUnspentTxOuts(address, unspentTxOuts))
    .map((uTxO) => uTxO.amount)
    .sum();
};
// 미사용 트랜잭션 뒤지기
const findUnspentTxOuts = (ownerAddress, unspentTxOuts) => {
  // 미사용 트랜잭션에서 요구하는 지갑주소(ownerAddress)와 일치하는
  // 지갑주소들(uTxO.address) 찾아서 반환
  return _.filter(unspentTxOuts, (uTxO) => uTxO.address === ownerAddress);
};

const findTxOutsForAmount = (amount, myUnspentTxOuts) => {
  let currentAmount = 0;
  const includedUnspentTxOuts = [];
  for (const myUnspentTxOut of myUnspentTxOuts) {
    includedUnspentTxOuts.push(myUnspentTxOut);
    currentAmount = currentAmount + myUnspentTxOut.amount;
    if (currentAmount >= amount) {
      const leftOverAmount = currentAmount - amount;
      return { includedUnspentTxOuts, leftOverAmount };
    }
  }

  const eMsg =
    "Cannot create transaction from the available unspent transaction outputs." +
    " Required amount:" +
    amount +
    ". Available unspentTxOuts:" +
    JSON.stringify(myUnspentTxOuts);
  throw Error(eMsg);
};

const createTxOuts = (receiverAddress, myAddress, amount, leftOverAmount) => {
  const txOut1 = new TX.TxOut(receiverAddress, amount);
  if (leftOverAmount === 0) {
    return [txOut1];
  } else {
    const leftOverTx = new TxOut(myAddress, leftOverAmount);
    return [txOut1, leftOverTx];
  }
};

const filterTxPoolTxs = (unspentTxOuts, transactionPool) => {
  const txIns = _(transactionPool)
    .map((tx) => tx.txIns)
    .flatten()
    .value();
  const removable = [];
  for (const unspentTxOut of unspentTxOuts) {
    const txIn = _.find(txIns, (aTxIn) => {
      return (
        aTxIn.txOutIndex === unspentTxOut.txOutIndex &&
        aTxIn.txOutId === unspentTxOut.txOutId
      );
    });

    if (txIn === undefined) {
    } else {
      removable.push(unspentTxOut);
    }
  }

  return _.without(unspentTxOuts, ...removable);
};

const createTransaction = (
  receiverAddress,
  amount,
  privateKey,
  unspentTxOuts,
  txPool
) => {
  console.log("txPool: %s", JSON.stringify(txPool));
  const myAddress = TX.getPublicKey(privateKey);
  const myUnspentTxOutsA = unspentTxOuts.filter(
    (uTxO) => uTxO.address === myAddress
  );

  const myUnspentTxOuts = filterTxPoolTxs(myUnspentTxOutsA, txPool);

  // filter from unspentOutputs such inputs that are referenced in pool
  const { includedUnspentTxOuts, leftOverAmount } = findTxOutsForAmount(
    amount,
    myUnspentTxOuts
  );

  const toUnsignedTxIn = (unspentTxOut) => {
    const txIn = new TX.TxIn();
    txIn.txOutId = unspentTxOut.txOutId;
    txIn.txOutIndex = unspentTxOut.txOutIndex;
    return txIn;
  };

  const unsignedTxIns = includedUnspentTxOuts.map(toUnsignedTxIn);

  const tx = new TX.Transaction();
  tx.txIns = unsignedTxIns;
  tx.txOuts = createTxOuts(receiverAddress, myAddress, amount, leftOverAmount);
  tx.id = TX.getTransactionId(tx);

  tx.txIns = tx.txIns.map((txIn, index) => {
    txIn.signature = TX.signTxIn(tx, index, privateKey, unspentTxOuts);
    return txIn;
  });

  return tx;
};

module.exports = {
  createTransaction,
  getPublicFromWallet,
  getPrivateFromWallet,
  getBalance,
  generatePrivateKey,
  initWallet,
  deleteWallet,
  findUnspentTxOuts,
};
