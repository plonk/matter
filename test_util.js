const {assertEquals, assertThrows, objectSlice, objectBecomeMerged} = require('./util');

var hoge = {a: 1, b: 2, c: 3};
assertEquals('{a : 1}', objectSlice(hoge, 'a').source());
objectSlice(hoge, ['a', 'b'] );

objectBecomeMerged({d: 4}, hoge);
objectBecomeMerged({c: 4}, hoge);
