const CryptoJS = require("crypto-js");
const ecdsa = require("elliptic");
const _ = require("lodash");

const EC = new ecdsa.ec("secp256k1");

const COINBASE_AMOUNT = 50;

// uTxOs(공용장부)에 들어갈 미사용 트랜잭션 아웃풋 클래스 정의
class UnspentTxOut {
  constructor(txOutId, txOutIndex, address, amount) {
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.address = address;
    this.amount = amount;
  }
}

// 트랜잭션 인풋 클래스 정의
class TxIn {
  constructor(txOutId, txOutIndex, signature) {
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.signature = signature;
  }
}

// 트랜잭션 아웃풋('누군가'에게 '얼마'를 보낸다) 클래스 정의
class TxOut {
  constructor(address, amount) {
    this.address = address;
    this.amount = amount;
  }
}

// 트랜잭션 클래스 정의
class Transaction {
  constructor(id, txIns, txOuts) {
    this.id = id;
    this.txIns = txIns;
    this.txOuts = txOuts;
  }
}

// 트랜잭션에 들어갈 id값 구하는 녀석
const getTransactionId = (transaction) => {
  // id값을 구할 해당 트랜잭션의 인풋들을 다 더하고
  const txInContent = transaction.txIns
    .map((txIn) => txIn.txOutId + txIn.txOutIndex)
    .reduce((a, b) => a + b, "");
  // 아웃풋들도 다 더해서
  const txOutContent = transaction.txOuts
    .map((txOut) => txOut.address + txOut.amount)
    .reduce((a, b) => a + b, "");
  // 그 둘을 더한것을 암호화한 문자열로 반환해서 id로 쓸거임
  return CryptoJS.SHA256(txInContent + txOutContent).toString();
};

// 트랜잭션 확인 (초기, 블록추가될 때, 체인교체될 때, 트랜잭션 추가될 때 사용됨)
// 트랜잭션 구조, 트랜잭션id, 트랜잭션 생성 주체의 서명,
// 트랜잭션의 인풋코인양과 아웃풋코인양의 일치여부 확인
const validateTransaction = (transaction, aUnspentTxOuts) => {
  // 트랜잭션 구조 검증하기
  if (!isValidTransactionStructure(transaction)) {
    return false;
  }
  // 해당 트랜잭션에 id가 실제 id 맞는지 계산해보기
  if (getTransactionId(transaction) !== transaction.id) {
    console.log("트랜잭션에 써있는 id가 짭이네요");
    return false;
  }

  // 해당 트랜잭션의 트잭인풋들을 공용장부랑 비교확인해서
  // 이상있는놈이 하나라도 있으면 false 반환하는 녀석
  const hasValidTxIns = transaction.txIns
    .map((txIn) => validateTxIn(txIn, transaction, aUnspentTxOuts))
    .reduce((a, b) => a && b, true);

  // uTxOs 트랜잭션 인풋들 검사해서 하나라도 이상이 있으면
  if (!hasValidTxIns) {
    console.log("(검사실패) 트랜잭션의 인풋중에 이상한 인풋이 있어요");
    return false;
  }

  // 총 보유 코인이 얼만지 계산하는 녀석
  // 공용장부에서 해당 트랜잭션의 인풋과 일치하는 것들(amount코인)을 찾아서 다 더해줌
  const totalTxInValues = transaction.txIns
    .map((txIn) => getTxInAmount(txIn, aUnspentTxOuts))
    .reduce((a, b) => a + b, 0);

  // 총 보내는 코인이 얼만지 계산하는 녀석(실제 보내는 코인 + 거슬러 받을 코인)
  const totalTxOutValues = transaction.txOuts
    .map((txOut) => txOut.amount)
    .reduce((a, b) => a + b, 0);

  // 해당 트랜잭션 내의 (총 보유 코인)과 (실제 보낼 코인+거슬러 받을 코인)이 다르면
  if (totalTxOutValues !== totalTxInValues) {
    console.log("(검사실패) 가진 코인과 주고받을 코인의 양이 달라요");
    return false;
  }

  return true;
};

// 블록의 트랜잭션들 정상인지 확인해보기 (초기, 블록추가될 때, 체인교체될 때 사용됨)
// (코인베이스, )
const validateBlockTransactions = (
  aTransactions,
  aUnspentTxOuts,
  blockIndex
) => {
  // 코인베이스 트랜잭션은 블록에 담긴 트랜잭션들중 [0]번째 요소니까
  // 변수coinbaseTx에 담아서 코인베이스 검증
  const coinbaseTx = aTransactions[0];
  if (!validateCoinbaseTx(coinbaseTx, blockIndex)) {
    console.log(
      "(검증실패) 블록에 들어있는 코인베이스 트랜잭션이 잘못되었습니다"
    );
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

// 코인베이스 트랜잭션 검사 (processTransactions 작동할 때 사용됨)
//                        (초기, 블록추가될 때, 체인교체될 때)
const validateCoinbaseTx = (transaction, blockIndex) => {
  // 코인베이스 트랜잭션이 null인 경우
  if (transaction == null) {
    console.log("(검증실패) 코인베이스 트랜잭션 자리가 비었네요(null)");
    return false;
  } // 블록에 기록된 코베트잭id가 코베트잭가지고 계산해본 코베트잭id와 다른경우
  if (getTransactionId(transaction) !== transaction.id) {
    console.log(
      "(검증실패) 코인베이스 트랜잭션의 id가 계산해보니 일치하지 않아요"
    );
    return false;
  } // 코베트잭의 인풋이 1개가 아닌경우
  if (transaction.txIns.length !== 1) {
    console.log("(검증실패) 코인베이스 트랜잭션의 인풋이 1개가 아니에요");
    return;
  } // 코베트잭의 인풋의 txOutIndex와 코베트잭이 들어있는 블록의 인덱스가 같지 않은 경우
  if (transaction.txIns[0].txOutIndex !== blockIndex) {
    console.log(
      "(검증실패) 코인베이스 tx의 txOutIndex와 블록의 높이가 다르네요"
    );
    return false;
  } // 코베트잭의 아웃풋이 1개가 아닌경우
  // (코베트잭에는 채굴자에게 보상주는 아웃풋 하나만 있어야함)
  if (transaction.txOuts.length !== 1) {
    console.log("(검증실패) 코인베이스 tx의 txOuts가 1개가 아니네요");
    return false;
  } // 코베트잭의 채굴자에게 보낼 보상금액이 설계된 금액(50)과 다른경우
  if (transaction.txOuts[0].amount !== COINBASE_AMOUNT) {
    console.log("(검증실패) 채굴보상금액이 설정된 금액과 달라요");
    return false;
  }
  return true;
};

// 트랜잭션 인풋 확인 (초기, 블록추가될 때, 체인교체될 때, 트랜잭션 추가될 때 사용됨)
const validateTxIn = (txIn, transaction, aUnspentTxOuts) => {
  // 공용장부에서 해당 트잭인풋과 같은게 있으면 referencedUTxOut(참조된 uTxO)에 저장
  const referencedUTxOut = aUnspentTxOuts.find(
    (uTxO) =>
      // 공용장부의 id === 해당 트잭인풋의 트잭아웃풋 id 이고
      uTxO.txOutId === txIn.txOutId &&
      // 공용장부의 트잭아웃풋 인덱스 === 해당 트잭인풋의 트잭아웃풋 인덱스인것을 찾아라
      uTxO.txOutIndex === txIn.txOutIndex
  );
  // 위와 같은게 하나도 없으면 문제
  if (referencedUTxOut == null) {
    console.log("(검사실패) 참조된 uTxO가 하나도 없답니다");
    return false;
  }
  // 참조된uTxO의 지갑주소 변수에 저장
  const address = referencedUTxOut.address;
  // 참조된uTxO의 지갑주소를 키쌍으로 변환
  const key = EC.keyFromPublic(address, "hex");
  // 서명 진퉁인지 확인
  // 해당 키쌍이(key) 해당 트랜잭션(id)에 알맞은 서명(signature)값이면 true
  const validSignature = key.verify(transaction.id, txIn.signature);
  // 서명이 짭이면
  if (!validSignature) {
    console.log("(검사실패) 본인의 서명이 아닌 모양입니다");
    return false;
  }
  return true;
};

//
const getTxInAmount = (txIn, aUnspentTxOuts) => {
  return findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts).amount;
};

// uTxOs(공용장부)에서 특정 트랜잭션과 일치하는 uTxO 찾아서 반환
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
  // 위 정보들로 코인베이스 트랜잭션의 id 만들어주기
  t.id = getTransactionId(t);
  return t;
};

// signature(서명) 만들기
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

// 공용장부 갱신 (초기, 블록추가될 때, 체인교체될 때 사용됨)
const updateUnspentTxOuts = (aTransactions, aUnspentTxOuts) => {
  // 새 공용장부 만들기
  const newUnspentTxOuts = aTransactions
    .map((t) => {
      // 트랜잭션들(aTransactions)의 (map)
      return t.txOuts.map(
        // 트잭아웃풋들(txOuts)의 (map) 아웃풋, 인덱스를 가지고
        (txOut, index) =>
          // 새 uTxO(미사용트랜잭션아웃풋) 만들어서
          new UnspentTxOut(t.id, index, txOut.address, txOut.amount)
      );
    }) // reduce, concat을 통해 새 배열(uTxOs)을 만들어서 변수newUnspentTxOuts에 저장
    .reduce((a, b) => a.concat(b), []);

  // 사용된 트잭아웃풋들 만들기
  const consumedTxOuts = aTransactions
    .map((t) => t.txIns) // 트랜잭션들의 인풋들[]을 배열로 만들고 [ [q], [w], [e] ]
    .reduce((a, b) => a.concat(b), []) // 배열껍데기 벗기고 [ q, w, e ]
    // 새 uTxO들로 만들어주기 [ qUTxO, wUTxO, eUTxO ]
    .map((txIn) => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, "", 0));

  const resultingUnspentTxOuts = aUnspentTxOuts
    .filter(
      // 기존장부에서 사용된 트잭아웃풋들에 해당되지 않는것들만 골라내어
      (uTxO) => !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts)
    ) // concat으로 새장부와 합쳐서 반환
    .concat(newUnspentTxOuts);
  // 예) 블록이 채굴되면 그 안에 담긴 트랜잭션들의 아웃풋들로는 새 장부를 만들고
  // 인풋들로는 consumedTxOuts(사용된 트잭아웃풋들)를 만들고
  // 새 장부에 (기존장부 - consumedTxOuts)를 합쳐서 새 장부를 정식등록한다
  return resultingUnspentTxOuts;
};

// 공용장부 갱신하기 (공용장부에서 거래내용(aTransactions) 정산해서)
//                 (갱신한 공용장부 반환 / 초기, 블록추가될 때, 체인교체될 때 사용됨)
const processTransactions = (aTransactions, aUnspentTxOuts, blockIndex) => {
  // 블록의 트랜잭션들 검사하기
  if (!validateBlockTransactions(aTransactions, aUnspentTxOuts, blockIndex)) {
    return null;
  }
  // 특정 블록에 담긴 트랜잭션(들)과 공용장부를 가지고 갱신한 새 공용장부를 반환
  return updateUnspentTxOuts(aTransactions, aUnspentTxOuts);
};

const toHexString = (byteArray) => {
  return Array.from(byteArray, (byte) => {
    return ("0" + (byte & 0xff).toString(16)).slice(-2);
  }).join("");
};

// 개인키로 공개키 만들기
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
