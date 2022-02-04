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
  console.log("새로 지갑 만들었어염 ->", privateKeyLocation);
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

// 지불할 금액에 대한 내 아웃풋들 찾기
const findTxOutsForAmount = (amount, myUnspentTxOuts) => {
  let currentAmount = 0; // 현재금액 0
  const includedUnspentTxOuts = []; // 포함된 uTxOs
  // 내 uTxO 갯수만큼 반복
  for (const myUnspentTxOut of myUnspentTxOuts) {
    // 포함된uTxOs 목록에 해당 uTxO 넣기
    includedUnspentTxOuts.push(myUnspentTxOut);
    // 현재 금액에 해당 uTxO의 금액만큼 더해주기
    currentAmount = currentAmount + myUnspentTxOut.amount;
    // 현재 금액이 지불할 금액 이상이면 짤짤이가 생김
    if (currentAmount >= amount) {
      // 짤짤이 = 내 현재금액 - 지불할 금액
      const leftOverAmount = currentAmount - amount;
      // 포함된uTxOs, 짤짤이 반환
      return { includedUnspentTxOuts, leftOverAmount };
    }
  } // 내uTxO들에 금액들이 각각 들어있는데
  // 그 금액들을 지불할 금액에 도달할 때까지 합치고
  // 합쳐진 uTxO는 추후에 정산할때 계산될듯--------------------------------
  /* 예) 내 지갑에 12원짜리, 8원짜리 5원짜리, 30원짜리가 있다.
        내가 A에게 21원을 줘야 한다.
        12원짜리, 8원짜리, 5원짜리를 합치니 25원이다(25원>=21원)
        포함된uTxOs에는 12원짜리, 8원짜리, 5원짜리 uTxO가 들어가고
        짤짤이는 4원이 생긴다(25원-21원)
        포함된uTxOs는 추후에 공용장부에서 날려버릴것이고
        짤짤이는 추후에 나에게 4원을 보내는 아웃풋이 되어 공용장부에 들어갈것이다 */

  // 지불할 금액이 모자라면 메시지 출력
  const eMsg = "트랜잭션을 만들 수 없어요. uTxO가 모자라던가 금액이 모자라요";
  throw Error(eMsg);
};

// 트랜잭션에 들어갈 아웃풋들 만들기
const createTxOuts = (receiverAddress, myAddress, amount, leftOverAmount) => {
  // 받는이(receiverAddress)에게 얼마(amount) 주겠다고 아웃풋 생성
  const txOut1 = new TX.TxOut(receiverAddress, amount);
  // 주고 거슬러 받을 코인이 없으면 해당 아웃풋 그대로 반환
  if (leftOverAmount === 0) {
    return [txOut1];
  } else {
    // 거슬러 받아야 할 코인이 있으면
    // 내 지갑주소로 거슬러 받을 금액이 적힌 아웃풋도 같이 반환
    const leftOverTx = new TX.TxOut(myAddress, leftOverAmount);
    return [txOut1, leftOverTx];
  }
};

// 공용장부의 내 명의 잔액에서
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

// 트랜잭션 만들어주기 / 매개변수는(받는이주소, 코인양, 비밀키, 공용장부, 트랜잭션풀)
// ()
const createTransaction = (
  receiverAddress,
  amount,
  privateKey,
  unspentTxOuts,
  txPool
) => {
  // 내 주소 = 내 비밀키를 가지고 만든 공개키
  const myAddress = TX.getPublicKey(privateKey);
  // 공용장부에서 내 명의로 된 잔액들 가져오기
  const myUnspentTxOutsA = unspentTxOuts.filter(
    (uTxO) => uTxO.address === myAddress
  );
  //
  const myUnspentTxOuts = filterTxPoolTxs(myUnspentTxOutsA, txPool);

  // 내uTxOs 에서 지불할 금액만큼 includedUnspentTxOuts(포함된uTxOs)랑
  // leftOverAmount(거스름돈) 만들어두기
  const { includedUnspentTxOuts, leftOverAmount } = findTxOutsForAmount(
    amount,
    myUnspentTxOuts
  );

  // 서명 없는 트랜잭션 인풋 만들기
  const toUnsignedTxIn = (unspentTxOut) => {
    const txIn = new TX.TxIn();
    txIn.txOutId = unspentTxOut.txOutId;
    txIn.txOutIndex = unspentTxOut.txOutIndex;
    return txIn;
  };
  // 포함된uTxOs로부터 인풋들 만들어서
  // unsignedTxIns(서명없는 트랜잭션인풋들 목록에 저장)
  const unsignedTxIns = includedUnspentTxOuts.map(toUnsignedTxIn);
  const tx = new TX.Transaction(); // 빈 트랜잭션 생성
  tx.txIns = unsignedTxIns; // 인풋들은 서명없는 트랜잭션인풋들을 넣고
  // 받는이에게 얼마보내는지의 아웃풋,
  // (거스름돈이 생기면)거스름돈을 나에게 보내는 아웃풋을 만들어
  // 트랜잭션의 아웃풋들(txOuts[])에 담기
  tx.txOuts = createTxOuts(receiverAddress, myAddress, amount, leftOverAmount);
  // 그러고 나서 인풋들(txIns)과 아웃풋들(txOuts)을 가지고 id만들어 담기
  tx.id = TX.getTransactionId(tx);

  // 내 비밀키를 가지고 서명 없이 담겨있는 인풋들에 서명 넣기
  tx.txIns = tx.txIns.map((txIn, index) => {
    txIn.signature = TX.signTxIn(tx, index, privateKey, unspentTxOuts);
    return txIn;
  });

  return tx; // 이렇게 완성된 트랜잭션 반환
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
