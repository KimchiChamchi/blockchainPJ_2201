const array1 = [1, 2, 3];

const abc = array1
  .map((a) => {
    if (a < 2) {
      console.log("map", false);
      return false;
    } else {
      console.log("map", false);
      return false;
    }
  })
  .includes(true);
console.log(abc);
