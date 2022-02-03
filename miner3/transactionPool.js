const _ = require("lodash");
const TX = require("./transaction");

// 트랜잭션 풀. 초기엔 빈배열. 채굴이 발생하기 전에 생기는 트랜잭션들이 담길것임
let transactionPool = [];

// 트랜잭션 풀 깊은 복사 해오기
const getTransactionPool = () => {
  return _.cloneDeep(transactionPool);
};

// 트랜잭션 검증해서 트랜잭션풀에 쑤셔넣기
// (누군가에게 broadcast로 트랜잭션풀 받았을 때,)
// (누군가에게 코인 보내려고 트랜잭션 만들었을 때 사용됨)
const addToTransactionPool = (tx, unspentTxOuts) => {
  // 트랜잭션 구조, 트랜잭션id, 트랜잭션 생성 주체의 서명,
  // 트랜잭션의 인풋코인양과 아웃풋코인양 일치여부 확인하기
  if (!TX.validateTransaction(tx, unspentTxOuts)) {
    throw Error(
      "트랜잭션 풀에 잘못된 트랜잭션이 들어왔어요(validateTransaction)"
    );
  }
  // 추가될 트랜잭션이 풀에 이미 있는지 검사
  if (!isValidTxForPool(tx, transactionPool)) {
    throw Error(
      "트랜잭션 풀에 이미 있는 트랜잭션이 들어왔어요(isValidTxForPool)"
    );
  }
  transactionPool.push(tx);
  console.log("트랜잭션 풀에 새로운 트랜잭션을 추가했습니다");
};

// 새로 갱신될 공용장부에 기존 트랜잭션풀에 있는 인풋과 같은게 있는지 검사
const hasTxIn = (txIn, unspentTxOuts) => {
  // 공용장부의   트잭아웃풋id  === 해당 트잭인풋의 트잭아웃풋id 이면서
  // 공용장부의 트잭아웃풋인덱스 === 해당 트잭인풋의 트잭아웃풋인덱스
  // 둘다 해당 되는놈을 찾아 반환해서 변수foundTxIn에 담기
  const foundTxIn = unspentTxOuts.find((uTxO) => {
    return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
  });

  // 해당되는게 없으면 해당인풋(TxIn)이 들어있는 tx를 새 pool에서 제외할것임
  return foundTxIn !== undefined;
};

// 트랜잭션 풀 업데이트하기 (블록 추가될 때, 블록체인 교체할 때 사용됨)
const updateTransactionPool = (unspentTxOuts) => {
  const invalidTxs = []; // 제외할 트랜잭션목록
  // 기존 트랜잭션풀의 '트랜잭션' 개수만큼 반복
  for (const tx of transactionPool) {
    // '그 트랜잭션'의 "인풋" 개수만큼 반복
    for (const txIn of tx.txIns) {
      // "그 인풋"이 새 공용장부에 있는 내용이면 통과, 없으면 '그 트랜잭션'을 제외목록에 추가
      if (!hasTxIn(txIn, unspentTxOuts)) {
        invalidTxs.push(tx);
        break;
      }
    }
  } // 제외할 트랜잭션목록이 하나라도 있으면
  if (invalidTxs.length > 0) {
    console.log("트랜잭션 풀에서 제외할 트랜잭션들을 제외합니다");
    // 트랜잭션풀에서 제외할 트랜잭션들은 제외하고 트랜잭션풀에 새로 담아주기
    // _.without(a,b,c...) a배열에서 b,c..등을 제외한 새로운 배열을 반환
    transactionPool = _.without(transactionPool, ...invalidTxs);
  } // 기존 pool에 있는 트랜잭션들은 기존 공용장부로부터 만들어졌으므로
  // 새 pool은 새 공용장부로부터 만들어진 tx들이 들어있어야 한다.
  // 그럼 기존 pool에 있는 인풋정보와 새 pool에 들어갈
  // 새 공용장부로부터 만들어질 tx의 정보는 달라야 정상이므로
  // hasTxIn함수 내에서 기존 pool에 있는 tx의 txOutId, txOutIndex와
  // 새 공용장부로 만들어질 tx의 txOutId,txOutIndex는 .find()로 인해 undefined가 나올것이고
  // 기존 pool에 있는 해당 tx는 제외 목록에 들어가서 _.without()을 통해 제외되고
  // 새 pool이 된다.
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
