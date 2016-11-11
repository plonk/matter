'use strict';

const {ScreenBuffer} = require('./screenBuffer.js');
const {inspect,assertEquals} = require ('./util.js');

var buf = new ScreenBuffer(80, 24);
var scr = (' '.repeat(80) + "\n").repeat(24);

assertEquals(scr, buf.toString());
