const _ = require("lodash");
const TX = require("./transaction");

let transactionPool = [];

// 트랜잭션 풀 깊은 복사 해오기
const getTransactionPool = () => {
  return _.cloneDeep(transactionPool);
};

// 트랜잭션 풀 검증해서
const addToTransactionPool = (tx, unspentTxOuts) => {
  if (!TX.validateTransaction(tx, unspentTxOuts)) {
    throw Error("트랜잭션 풀에 잘못된 트랜잭션이 들어왔어요");
  }

  if (!isValidTxForPool(tx, transactionPool)) {
    throw Error("트랜잭션 풀에 잘못된 트랜잭션이 들어왔어요");
  }
  console.log("adding to txPool: %s", JSON.stringify(tx));
  transactionPool.push(tx);
};

// 새로 갱신될 공용장부에 기존 트랜잭션풀에 있는 인풋이 있는지 검사
const hasTxIn = (txIn, unspentTxOuts) => {
  // 공용장부의 트잭아웃풋id === 해당 트잭인풋의 트잭아웃풋id 이면서
  // 공용장부의 트잭아웃풋인덱스 === 해당 트잭인풋의 트잭아웃풋인덱스
  // 둘다 해당 되면
  const foundTxIn = unspentTxOuts.find((uTxO) => {
    return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
  });
  // 같은게 없고 undefined가 아니라면 통과시켜주기 위해 true 반환
  return foundTxIn !== undefined;
};

// 트랜잭션 풀 업데이트하기
const updateTransactionPool = (unspentTxOuts) => {
  const invalidTxs = []; // 제외할 트랜잭션목록
  // 기존 트랜잭션풀의 트랜잭션 개수만큼 반복
  for (const tx of transactionPool) {
    // 그 트랜잭션의 인풋 개수만큼 반복
    for (const txIn of tx.txIns) {
      // 트랜잭션-------------------------------------해석실패
      if (!hasTxIn(txIn, unspentTxOuts)) {
        invalidTxs.push(tx);
        break;
      }
    }
  } // 제외할 트랜잭션목록이 하나라도 있으면
  if (invalidTxs.length > 0) {
    console.log(
      "트랜잭션 풀에서 제외할 트랜잭션들을 제외합니다",
      JSON.stringify(invalidTxs)
    ); // 트랜잭션풀에서 제외할 트랜잭션들 제외하고 트랜잭션풀에 새로 담아주기
    transactionPool = _.without(transactionPool, ...invalidTxs);
  }
};

// 트랜잭션풀에서 트랜잭션 인풋들만 가져오기
const getTxPoolIns = (aTransactionPool) => {
  return _(aTransactionPool)
    .map((tx) => tx.txIns)
    .flatten()
    .value();
};

// 전달받은 트랜잭션이 트랜잭션풀에 있는 트랜잭션들과 중복되는지 검사하기
const isValidTxForPool = (tx, aTtransactionPool) => {
  // 트랜잭션풀에서 트랜잭션 인풋들만 가져와서 변수txPoolIns에 저장
  const txPoolIns = getTxPoolIns(aTtransactionPool);
  // 트랜잭션풀에 있는 인풋들에서 트랜잭션
  const containsTxIn = (txIns, txIn) => {
    return _.find(txPoolIns, (txPoolIn) => {
      return (
        // 전달받은 트잭인풋의 트잭아웃풋인덱스 === 트잭풀에 있는 트잭아웃풋인덱스
        // 전달받은 트잭인풋의 트잭아웃풋ID === 트잭풀에 있는 트잭아웃풋ID
        // 둘다 같은게 있는지 찾아보기
        txIn.txOutIndex === txPoolIn.txOutIndex &&
        txIn.txOutId === txPoolIn.txOutId
      );
    });
  };
  // 전달받은 트랜잭션의 인풋들 개수만큼 반복
  for (const txIn of tx.txIns) {
    // 전달받은 트랜잭션의 인풋이 트랜잭션풀에 있는 인풋과 같으면
    if (containsTxIn(txPoolIns, txIn)) {
      console.log("이건 ", txIn, " 이미 트랜잭션 풀에 있는 트랜잭션이네요");
      return false;
    }
  }
  return true;
};

module.exports = {
  addToTransactionPool,
  getTransactionPool,
  updateTransactionPool,
};
