let 사당집세 = 0;
let 천호집세 = 40;
let 교통비 = 8;
let 공과금 = 5;
let 이사비용 = 2;
let 지하던전가치 = 20 * 0.6;
let 룸메의가치 = undefined;
let 상민지원금 = 10;

let 사당살면드는돈 = 사당집세 + 교통비 + 공과금 + 이사비용;
let 천호살면드는돈 = 천호집세 - 지하던전가치 - 상민지원금;
console.log(사당살면드는돈);
console.log(천호살면드는돈);
console.log("차액", 사당살면드는돈 - 천호살면드는돈);
