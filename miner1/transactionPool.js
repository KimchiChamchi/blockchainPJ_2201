const _ = require("lodash");
const TX = require("./transaction");

let transactionPool = [];

// 트랜잭션 풀 깊은 복사 해오기
const getTransactionPool = () => {
  return _.cloneDeep(transactionPool);
};

// 트랜잭션 검증해서 트랜잭션풀에 쑤셔넣기
// (누군가에게 broadcast로 트랜잭션풀 받았을 때,)
// (누군가에게 코인 보낼때 사용됨)
const addToTransactionPool = (tx, unspentTxOuts) => {
  if (!TX.validateTransaction(tx, unspentTxOuts)) {
    throw Error(
      "트랜잭션 풀에 잘못된 트랜잭션이 들어왔어요(validateTransaction)"
    );
  }

  if (!isValidTxForPool(tx, transactionPool)) {
    throw Error(
      "트랜잭션 풀에 이미 있는 트랜잭션이 들어왔어요(isValidTxForPool)"
    );
  }
  transactionPool.push(tx);
  console.log("트랜잭션 풀에 새로운 트랜잭션을 추가했습니다");
};

/*******************************************************************해석실패 */
// 새로 갱신될 공용장부에 기존 트랜잭션풀에 있는 인풋이 있는지 검사
const hasTxIn = (txIn, unspentTxOuts) => {
  // 공용장부의 트잭아웃풋id === 해당 트잭인풋의 트잭아웃풋id 이면서
  // 공용장부의 트잭아웃풋인덱스 === 해당 트잭인풋의 트잭아웃풋인덱스
  // 둘다 해당 되는놈을 찾아 반환해서 변수foundTxIn에 담기
  console.log("안녕?");
  const foundTxIn = unspentTxOuts.find((uTxO) => {
    return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
  });
  // 해당되는게 없으면
  return foundTxIn !== undefined;
};

// 트랜잭션 풀 업데이트하기
const updateTransactionPool = (unspentTxOuts) => {
  console.log("업데이트 트잭풀");
  const invalidTxs = []; // 제외할 트랜잭션목록
  // 기존 트랜잭션풀의 트랜잭션 개수만큼 반복
  for (const tx of transactionPool) {
    console.log("나는 for문");

    // 그 트랜잭션의 인풋 개수만큼 반복
    for (const txIn of tx.txIns) {
      console.log("나는 두번째 for문");
      // 그 인풋이 공용장부에
      if (!hasTxIn(txIn, unspentTxOuts)) {
        invalidTxs.push(tx);
        console.log("나는 hasTxIn 통과");
        break;
      }
    }
  } // 제외할 트랜잭션목록이 하나라도 있으면
  if (invalidTxs.length > 0) {
    console.log(
      "트랜잭션 풀에서 제외할 트랜잭션들을 제외합니다"
      // JSON.stringify(invalidTxs)
    ); // 트랜잭션풀에서 제외할 트랜잭션들은 제외하고 트랜잭션풀에 새로 담아주기
    // _.without(a,b,c...) a배열에서 b,c..등을 제외한 새로운 배열을 반환
    transactionPool = _.without(transactionPool, ...invalidTxs);
  }
};
/*******************************************************************해석실패 */

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
