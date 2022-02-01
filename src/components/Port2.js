import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Row, Col, Badge, Card, Input, Button } from "antd";

function Port2() {
  const [블록데이터, set블록데이터] = useState(""); //생성데이터
  const [peer, setPeer] = useState(""); //생성데이터
  const [peers, setPeers] = useState(" "); //생성데이터
  const [Wallet, setWallet] = useState([]); // 지갑 공개키
  const [Money, setMoney] = useState(0);
  const [MoneyToAddress, setMoneyToAddress] = useState("");
  const [Balance, setBalance] = useState([]); // 지갑 잔액
  const [chainBlocks, setChainBlocks] = useState([]); //db불러온거
  const reverse = [...chainBlocks].reverse(); //배열뒤집어주기
  const [shownBlock, setshownBlock] = useState({});
  const [count, setCount] = useState(0);
  const [delay, setDelay] = useState(1000);
  const [isRunning, setIsRunning] = useState(false);
  const [ok, setOk] = useState(false);
  useInterval(
    () => {
      const data = 블록데이터 || "3번채굴기입니다.";
      setIsRunning(false);
      console.log("데이터전송");
      axios
        .post(`http://localhost:3002/mineBlock`, { data: [data] })
        .then((res) => {
          console.log(res.data);
          setIsRunning(true);
        });

      setCount(count + 1);
    },
    isRunning && ok ? delay : null
  );

  const bcMaker = async () => {
    const data = 블록데이터;
    if (data.length === 0) {
      //데이터없으면 리네임
      return alert(`데이터를 넣어주세용`);
    }
    await axios
      .post(`http://localhost:3002/mineBlock`, { data: [data] })
      .then((res) => alert(res.data));
  };

  const getBlockchain = async () => {
    await axios
      .get(`http://localhost:3002/blocks`)
      .then((res) => setChainBlocks(res.data));
  };

  // 지갑 공개키 받아오기
  const getAddress = async () => {
    await axios
      .get(`http://localhost:3002/address`)
      .then((res) => setWallet(res.data.address));
  };

  // 지갑 잔액 조회
  const getBalance = async () => {
    await axios
      .get(`http://localhost:3002/balance`)
      .then((res) => setBalance(res.data.balance));
  };
  //
  const sendTransaction = async () => {
    await axios
      .post(`http://localhost:3002/sendTransaction`, {
        address: MoneyToAddress,
        amount: Money,
      })
      .then((res) => console.log(res.data));
  };
  const stop = async () => {
    await axios
      .post(`http://localhost:3002/stop`)
      .then((res) => alert(res.data));
  };

  const getpeers = async () => {
    axios.get(`http://localhost:3002/peers`).then((res) => setPeers(res.data));
  };
  if (peers.length === 0) {
    return setPeers(`연결된 피어가없어요`);
  }

  const addPeer = async () => {
    const P = peer;
    if (P.length === 0) {
      //데이터없으면 리네임
      return alert(`peer내용을 넣어주세용`);
    }
    await axios
      .post(`http://localhost:3002/addPeer`, {
        peer: [`ws://localhost:${P}`],
      })
      .then((res) => alert(res.data));
  };

  const toggleBlockInfo = (blockchain) => {
    console.log([blockchain.index]);
    setshownBlock((prevShownComments) => ({
      ...prevShownComments,
      [blockchain.index]: !prevShownComments[blockchain.index],
    }));
  };

  function handleDelayChange(e) {
    setDelay(Number(e.target.value));
  }

  return (
    <div>
      <Row>
        <Col span={24}>
          {" "}
          <h1>3003포트 WS6003입니다.</h1>
        </Col>
      </Row>
      <br />
      <Button style={{ marginTop: 5 }} type="dashed" onClick={getAddress}>
        지갑확인
      </Button>
      <Button style={{ marginTop: 5 }} type="dashed" onClick={getBalance}>
        잔액 조회
      </Button>
      {/* <Button style={{ marginLeft: 40, }} type="dashed" onClick={stop}>서버종료</Button> */}

      <div className="wallet_bublic_key_div">
        <div className="wallet_bublic_key_div-title">
          <b>내 공개키 : </b>
        </div>
        <div className="wallet_bublic_key_div-content">{Wallet}</div>
      </div>
      <div className="wallet_bublic_key_div">
        <div className="wallet_bublic_key_div-title">
          <b>아름다운 잔액 : </b>
        </div>
        <div className="wallet_bublic_key_div-content">{Balance}</div>
      </div>
      <hr className="boundary_line"></hr>
      <Col span={20}>
        <Input
          addonBefore="ws://localhost:"
          placeholder=" ex)6001 "
          onChange={(e) => {
            setPeer(e.target.value);
          }}
          value={peer}
        />
      </Col>
      <Button style={{ marginTop: 5 }} type="dashed" onClick={addPeer}>
        피어연결
      </Button>
      <Button style={{ marginLeft: 40 }} type="dashed" onClick={getpeers}>
        피어 연결목록확인
      </Button>
      <p>
        {" "}
        <b style={{ marginLeft: 10 }}> peers : </b> {peers}
      </p>
      <hr className="boundary_line"></hr>
      <Col span={3}>
        <Input
          placeholder="얼마면 돼?"
          type="number"
          onChange={(e) => {
            setMoney(e.target.value);
          }}
          value={Money}
        />
      </Col>
      <Col span={20}>
        <Input
          placeholder="어디다가?"
          type="text"
          onChange={(e) => {
            setMoneyToAddress(e.target.value);
          }}
          value={MoneyToAddress}
        />
      </Col>
      <Button style={{ marginTop: 5 }} type="dashed" onClick={sendTransaction}>
        내 피같은 코인 숑숑 전송
      </Button>
      <hr className="boundary_line"></hr>
      <Col span={20}>
        <Input
          placeholder="블록내용을 입력해주세요"
          type="text"
          onChange={(e) => {
            set블록데이터(e.target.value);
          }}
          value={블록데이터}
        />
      </Col>
      <Button
        style={{ marginTop: 5, marginBottom: 10 }}
        type="dashed"
        onClick={bcMaker}
      >
        블록만들기 얍~
      </Button>
      <Button style={{ marginLeft: 30 }} type="dashed" onClick={getBlockchain}>
        블록체인 목록 불러오기
      </Button>
      <Button
        style={{ marginLeft: 30 }}
        type="dashed"
        onClick={() => {
          alert("채굴을 시작합니당.");
          setIsRunning(true), setOk(true);
        }}
      >
        채굴
      </Button>
      <Button
        style={{ marginLeft: 30 }}
        type="dashed"
        onClick={() => {
          alert("채굴을 중지합니당.");
          setOk(false);
        }}
      >
        중지
      </Button>
      <div className="auto_mine_box">
        <h1>자동 채굴양 {count}</h1>
        <input value={delay} onChange={handleDelayChange} />
      </div>
      {reverse.map((blockData) => {
        return (
          <ul key={blockData.index}>
            <div
              onClick={() => {
                toggleBlockInfo(blockData);
              }}
            >
              <Badge.Ribbon text="Block Chain">
                <Card size="small" className="block_box">
                  <div>{blockData.index}번 블록</div>
                </Card>
              </Badge.Ribbon>
            </div>

            {shownBlock[blockData.index] ? (
              <Col span={23}>
                <Row justify="end">
                  <Col span={23}>
                    <Card
                      size="small"
                      title="정보"
                      className="block_box-block_info"
                    >
                      <li>
                        <div>
                          <div>index</div>
                        </div>
                        <div>{blockData.index}</div>
                      </li>
                      <hr className="boundary_line"></hr>
                      <li>
                        <div>
                          <div>previousHash</div>
                        </div>
                        <div>{blockData.previousHash}</div>
                      </li>
                      <hr className="boundary_line"></hr>
                      <li>
                        <div>
                          <div>timestamp</div>
                        </div>
                        <div>{blockData.timestamp}</div>
                      </li>
                      <hr className="boundary_line"></hr>
                      <li>
                        <div>
                          <div>hash</div>
                        </div>
                        <div>{blockData.hash}</div>
                      </li>
                      <hr className="boundary_line"></hr>
                      <li>
                        <div>
                          <div>difficulty</div>
                        </div>
                        <div>{blockData.difficulty}</div>
                      </li>
                      <hr className="boundary_line"></hr>
                      <li>
                        <div>
                          <div>nonce</div>
                        </div>
                        <div>{blockData.nonce}</div>
                      </li>
                      <hr className="boundary_line"></hr>
                      <div className="Transaction-title">Transactions</div>
                      {blockData.data.map((transaction) => {
                        return (
                          <div
                            className="Transaction-content"
                            key={transaction.id}
                          >
                            <div className="Transaction-content_box">
                              <div className="Transaction-content_info_id">
                                <div>Id</div>
                                <div>{transaction.id}</div>
                              </div>
                              {transaction.txIns.map((txIn) => {
                                return (
                                  <div
                                    className="Transaction-content_info"
                                    key={txIn.signature}
                                  >
                                    <div className="Transaction-content_info_txIn">
                                      <div>signature</div>
                                      <div>{txIn.signature}</div>
                                    </div>
                                    <div className="Transaction-content_info_txIn">
                                      <div>txOutId</div>
                                      <div>{txIn.txOutId}</div>
                                    </div>
                                    <div className="Transaction-content_info_txIn">
                                      <div>txOutIndex</div>
                                      <div>{txIn.txOutIndex}</div>
                                    </div>
                                  </div>
                                );
                              })}
                              {transaction.txOuts.map((txOut, index) => {
                                return (
                                  <div
                                    className="Transaction-content_info"
                                    key={index}
                                  >
                                    <div className="Transaction-content_info_txOut">
                                      <div>address</div>
                                      <div>{txOut.address}</div>
                                    </div>
                                    <div className="Transaction-content_info_txOut">
                                      <div>amount</div>
                                      <div>{txOut.amount}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </Card>
                  </Col>
                </Row>
              </Col>
            ) : null}
          </ul>
        );
      })}
    </div>
  );
}
function useInterval(callback, delay) {
  const savedCallback = useRef();

  // Remember the latest function.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

export default Port2;
