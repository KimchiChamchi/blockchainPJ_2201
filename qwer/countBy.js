const _ = require("lodash");

// Original array

var obj1 = [
  { txOutId: "asdf", txOutIndex: 1 },
  { txOutId: "asdf", txOutIndex: 2 },
];
var obj2 = ["q", "r", "s", "p"];

// Use of _.countBy() method

// The `_.property` iteratee shorthand.
let x = _.countBy(obj1, (txIn) => txIn.txOutId + txIn.txOutIndex);
let y = _.countBy(obj2, "length");

// Printing the output
console.log(x);
console.log(y);
