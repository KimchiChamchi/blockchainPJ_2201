// Requiring the lodash library
const _ = require("lodash");

// Original array
let array1 = [[1, [2]], [[4, 5]], [7, 8], [[], [[]]]];

// Using _.flatten() method
let newArray = _(array1).flatten(2).value();

// Printing original Array
console.log("original Array1: ", array1);

// Printing the newArray
console.log("new Array: ", newArray);
