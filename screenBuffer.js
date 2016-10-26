var eastasianwidth = require('eastasianwidth');

function GraphicAttrs() {
  // 色インデックスで指定するのはよくないな。
  this.reset();
}

GraphicAttrs.prototype.reset = function () {
  this.textColor = 0;
  this.backgroundColor = 7;
  this.bold = false;
  this.italic = false;
  this.blink = false;
  this.fastBlink = false;
  this.fraktur = false;
  this.crossedOut = false;
  this.underline = false;
  this.faint = false;
  this.conceal = false;
};

GraphicAttrs.prototype.clone = function () {
  var res = new GraphicAttrs();
  for (var attr of ['textColor', 'backgroundColor', 'bold', 'italic', 'blink', 'fastBlink', 'fraktur', 'crossedOut', 'underline', 'faint', 'conceal']) {
    res[attr] = this[attr];
  }
  return res;
};

function Cell() {
  this.character = ' ';
  this.broken = false;
  this.attrs = new GraphicAttrs();
}

function ScreenBuffer(term, columns, rows) {
  if (columns <= 0) throw RangeError('columns');
  if (rows <= 0) throw RangeError('rows');

  this.columns = columns;
  this.rows = rows;
  this.buffer = Array.from(Array(columns * rows), () => new Cell());
  this.cursor_x = 0;
  this.cursor_y = 0;
  this.interpretFn = ScreenBuffer.prototype.fc_normal;
  this.graphicAttrs = new GraphicAttrs();
  this.title = '';
  this.isCursorVisible = true;
  this.term = term;
  this.lastGraphicCharacter = ' ';
}

ScreenBuffer.prototype.resize = function (columns, rows) {
  throw 'not implemented';
};

ScreenBuffer.prototype.cursorOffset = function () {
  return this.cursor_y * this.columns + this.cursor_x;
};

ScreenBuffer.prototype.advanceCursor = function () {
  if (this.cursor_x === this.columns - 1) {
    if (this.cursor_y === this.rows - 1) {
      this.lineFeed();
    } else {
      this.cursor_y += 1;
    }
    this.cursor_x = 0;
  } else {
    this.cursor_x += 1;
  }
};

ScreenBuffer.prototype.backCursor = function () {
  if (this.cursor_x === 0) {
    if (this.cursor_y === 0) {
      ;
    } else {
      this.cursor_y -= 1;
      this.cursor_x = this.columns - 1;
    }
  } else {
    this.cursor_x -= 1;
  }
};

ScreenBuffer.prototype.lineFeed = function () {
  var len = this.buffer.length;

  this.buffer = this.buffer
    .slice(this.columns)
    .concat(Array.from(Array(this.columns), () => new Cell()));

  if (this.buffer.length !== len) {
    throw 'error';
  }
};

// 行末に文字を追加しても、次の行にいっちゃいけないんだよなぁ。むずかしい。
// 画面の右下のセルに文字を表示しても、画面がスクロールしてはいけない。
// どうやって実装するんだろう。

ScreenBuffer.prototype.fc_normal = function (c) {
  if (c === '\x08') { // ^H
    this.backCursor();
  } else if (c === '\x0a') { // LF ^J
    if (this.cursor_y === this.rows - 1) {
      this.lineFeed();
    } else {
      this.cursor_y += 1;
    }
  } else if (c === '\x0d') { // CR ^M
    this.cursor_x = 0;
  } else if (c === '\x1b') { // ESC ^[
    return ScreenBuffer.prototype.fc_esc;
  } else if (c === '\x09') { // Tab ^I
    this.tabStopForward(1);
  } else if (c === '\x07') { // BEL ^G
    ;
  } else {
    // 文字の追加。
    this.addCharacter(c);
  }
  return ScreenBuffer.prototype.fc_normal;
};

function wcwidth(c) {
  switch (eastasianwidth.eastAsianWidth(c)) {
  case 'Na':
  case 'N':
  case 'H':
    return 1;
  case 'A': // ambiguous;
    return 1;
  case 'W':
  case 'F':
    return 2;
  default:
    console.log(`wcwidth ${c}`);
    return 1;
  }
}

ScreenBuffer.prototype.addCharacter = function (c) {
  this.lastGraphicCharacter = c;
  switch (wcwidth(c)) {
  case 1:
    var cell = this.buffer[this.cursorOffset()];
    cell.attrs = this.graphicAttrs.clone();
    cell.character = c;
    this.advanceCursor();
    break;
  case 2:
    this.buffer[this.cursorOffset()].attrs = this.graphicAttrs.clone();
    this.buffer[this.cursorOffset()].character = c;
    this.buffer[this.cursorOffset() + 1].attrs = this.graphicAttrs.clone();
    this.buffer[this.cursorOffset() + 1].character = '';
    this.advanceCursor();
    this.advanceCursor();
    break;
  default:
    console.log(`length ${c}`)
    break;
  }
};

ScreenBuffer.prototype.repeatLastCharacter = function (args_str) {
  var num = +(args_str || '1'); // デフォルト値不明

  for (var i = 0; i < num ; i++)
    this.addCharacter(this.lastGraphicCharacter);
};

// 画面のクリア。カーソル位置はそのまま。
ScreenBuffer.prototype.clear = function (from, to) {
  this.buffer = Array.from(Array(this.columns * this.rows), () => new Cell());
};

ScreenBuffer.prototype.fc_controlSequenceIntroduced = function (c) {
  var args = '';
  function parsingControlSequence(c) {
    if (/^[\x40-\x7e]$/.exec(c)) {
      this.dispatchCommand(c, args);
      return this.fc_normal;
    } else if (/^[0-9]$/.exec(c) || c === ';') {
      args += c;
      return parsingControlSequence;
    } else if (c === '?') {
      return function (c) {
        if (c === '2') {
          return function (c) {
            if (c === '5') {
              return function (c) {
                if (c === 'l') {
                  // hide
                  this.isCursorVisible = false;
                } else if (c === 'h') {
                  // show
                  this.isCursorVisible = true;
                } else {
                  console.log(`unexpected character ${c}`);
                }
                return this.fc_normal;
              };
            } else {
              console.log(`unexpected character ${c}`);
              return this.fc_normal;
            }
          };
        } else {
          console.log(`unexpected character ${c}`);
          return this.fc_normal;
        }
      };
    } else {
      console.log(`unexpected character ${c}`);
      return this.fc_normal;
    }
  }
  return parsingControlSequence.call(this, c);
};


ScreenBuffer.prototype.cursorPosition = function (args_str) {
  // console.log('CUP', args_str);
  var args = args_str.split(/;/);
  var y = (args[0] || '1') - 1;
  var x = (args[1] || '1') - 1;

  this.cursor_y = y;
  this.cursor_x = x;
};

ScreenBuffer.prototype.eraseDisplay = function (args_str) {
  switch (args_str || '0') {
  case '0':
    this.clear(this.cursor_y * this.columns + this.cursor_x, this.columns * this.rows);
  case '1':
    // カーソルを含まない？
    this.clear(0, this.cursor_y * this.columns + this.cursor_x);
    break;
  case '2':
    this.clear(0, this.columns * this.rows);
    break;
  default:
    console.log(`Error: ED ${args_str}`);
    break;
  }
};

ScreenBuffer.prototype.defaultTextColor = function () {
  this.graphicAttrs.textColor = 0;
};

ScreenBuffer.prototype.reverseVideo = function () {
  var attrs = this.graphicAttrs;
  var oldTextColor = attrs.textColor;
  attrs.textColor = attrs.backgroundColor;
  attrs.backgroundColor = oldTextColor;
};

ScreenBuffer.prototype.defaultBackgroundColor = function () {
  this.graphicAttrs.backgroundColor = 7;
};

ScreenBuffer.prototype.selectGraphicRendition = function (args_str) {
  var args = args_str.split(/;/).map(num_str => (num_str === '') ? 0 : +num_str);
  var i = 0;

  while (i < args.length) {
    var arg = args[i];
    if (arg === 0) {
      this.graphicAttrs.reset();
      i++;
    } else if (arg === 1) {
      this.graphicAttrs.bold = true;
      i++;
    } else if (arg === 2) { // faint
      this.graphicAttrs.faint = true;
      i++;
    } else if (arg === 3) { // italic
      this.graphicAttrs.italic = true;
      i++;
    } else if (arg === 4) { // underline
      this.graphicAttrs.underline = true;
      i++;
    } else if (arg === 5) { // blink slow
      this.graphicAttrs.blink = true;
      i++;
    } else if (arg === 6) { // blink rapid
      this.graphicAttrs.fastBlink = true;
      i++;
    } else if (arg === 7) {
      this.reverseVideo();
      i++;
    } else if (arg === 8) { // conceal
      this.graphicAttrs.conceal = true;
      i++;
    } else if (arg === 9) { // crossed out
      this.graphicAttrs.crossedOut = true;
      i++;
    } else if (arg >= 10 && arg <= 19) {
      // Unimplemented
      // this.setFont(arg - 10);
      console.log(`unsupported SGR arg ${args[i]}`);
      i++;
    } else if (arg === 20) { // fraktur
      this.graphicAttrs.fraktur = true;
      i++;
    } else if (arg === 21) { // bold off (or underline double)
      this.graphicAttrs.bold = false;
      i++;
    } else if (arg === 22) { // normal color/intensity
      console.log(`unsupported SGR arg ${args[i]}`);
      i++;
    } else if (arg === 23) { // neither italic nor fraktur
      console.log(`unsupported SGR arg ${args[i]}`);
      i++;
    } else if (arg === 24) { // underline: none
      console.log(`unsupported SGR arg ${args[i]}`);
      i++;
    } else if (arg === 25) { // blink: off
      console.log(`unsupported SGR arg ${args[i]}`);
      i++;
    } else if (arg === 27) { // image: positive
      console.log(`unsupported SGR arg ${args[i]}`);
      i++;
    } else if (arg === 28) { // reveal
      console.log(`unsupported SGR arg ${args[i]}`);
      i++;
    } else if (arg === 29) { // not crossed out
      console.log(`unsupported SGR arg ${args[i]}`);
      i++;
    } else if (arg >= 30 && arg <= 37) {
      this.graphicAttrs.textColor = arg - 30;
      i++;
    } else if (arg === 38) { // extended set foreground
      console.log(`unsupported SGR arg ${args[i]}`);
      i++;
    } else if (arg === 39) {
      this.defaultTextColor();
      i++;
    } else if (arg >= 40 && arg <= 47) {
      this.graphicAttrs.backgroundColor = arg - 40;
      i++;
    } else if (arg === 49) {
      this.defaultBackgroundColor();
      i++;
    } else {
      console.log(`unknown SGR arg ${args[i]}`);
      return;
    }
  }
};

ScreenBuffer.prototype.cursorForward = function (args_str) {
  var num = +(args_str || '1');

  this.cursor_x = Math.min(this.cursor_x + num, this.columns - 1);
};

ScreenBuffer.prototype.cursorBackward = function (args_str) {
  var num = +(args_str || '1');

  this.cursor_x = Math.max(this.cursor_x - num, 0);
};

ScreenBuffer.prototype.cursorDown = function (args_str) {
  var num = +(args_str || '1');
  this.cursor_y = Math.min(this.cursor_y + num, this.rows - 1);
};

ScreenBuffer.prototype.cursorUp = function (args_str) {
  var num = +(args_str || '1');
  this.cursor_y = Math.max(this.cursor_y - num, 0);
};

ScreenBuffer.prototype.eraseInLine = function (args_str) {
  var num = +args_str;
  switch (num) {
  case 0: // to the end
    for (var i = this.cursor_x; i < this.columns; i++) {
      this.buffer[this.cursor_y * this.columns + i] = new Cell();
    }
    break;
  case 1: // to the beginning
    // FIXME: カーソル位置の文字を消すのか不明。
    for (var i = 0; i < this.cursor_x; i++) {
      this.buffer[this.cursor_y * this.columns + i] = new Cell();
    }
    break;
  case 2: // entire line
    for (var i = 0; i < this.columns; i++) {
      this.buffer[this.cursor_y * this.columns + i] = new Cell();
    }
    break;
  default:
    console.log(`EL ${args_str}`);
    break;
  }
};

ScreenBuffer.prototype.deviceStatusReport = function (args_str) {
  var y = this.cursor_y + 1;
  var x = this.cursor_x + 1;
  this.term.write(`\x1b[${y};${x}R`);
};

ScreenBuffer.prototype.cursorToLine = function (args_str) {
  var num = +(args_str || '1');

  this.cursor_y = num - 1;
};

ScreenBuffer.prototype.deleteCharacters = function (args_str) {
  var num = +(args_str || '1');

  num = Math.min(num, this.columns - this.cursor_x);

  for (var i = 0; i < this.columns - this.cursor_x - num; i++) {
    this.buffer[this.cursor_y * this.columns + this.cursor_x + i] =
      this.buffer[this.cursor_y * this.columns + this.cursor_x + i + num];
  }
  for (var offset = (this.cursor_y + 1) * this.columns - num;
       offset < (this.cursor_y + 1) * this.columns;
       offset++) {
    this.buffer[offset] = new Cell();
  }
};

ScreenBuffer.prototype.eraseCharacters = function (args_str) {
  var num = +(args_str || '1');

  num = Math.min(num, this.columns - this.cursor_x);

  for (var i = 0; i < num; i++) {
    this.buffer[this.cursor_y * this.columns + this.cursor_x + i] = new Cell();
  }
};

ScreenBuffer.prototype.cursorHorizontalAbsolute = function (args_str) {
  var num = +(args_str || '1');

  this.cursor_x = num - 1;
};

ScreenBuffer.prototype.tabStopForward = function (args) {
  var num = +args;

  this.cursor_x = Math.min(this.columns - 1, (Math.floor(this.cursor_x / 8) + num) * 8);
};

ScreenBuffer.prototype.tabStopBackward = function (args) {
  var num = +args;

  this.cursor_x = Math.max(0, (Math.floor(this.cursor_x / 8) - num) * 8);
};

ScreenBuffer.prototype.insertBlankCharacters = function (args_str) {
  var num = +args_str;

  // line[cursor_x] から line[columns - 1 - num] までを
  // line[cursor_x + num] から line[columns - 1] までにコピーする。
  // i は 行の先頭からのオフセット位置。
  for (var i = this.columns - 1 - num; i >= this.cursor_x; i--) {
    this.buffer[this.cursor_y * this.columns + i + num] =
      this.buffer[this.cursor_y * this.columns + i];
  }

  // line[cursor_x] から line[cursor_x + num - 1] までを空白にする。
  for (var j = 0; j < num; j++) {
    this.buffer[this.cursor_y * this.columns + this.cursor_x + j] = new Cell();
  }
};

ScreenBuffer.prototype.insertLines = function (args_str) {
  var num = +(args_str || '1');
  var newLines = Array.from(Array(num * this.columns), () => new Cell());

  var args = [this.cursor_y * this.columns, 0].concat(newLines);
  Array.prototype.splice.apply(this.buffer, args);

  this.buffer = this.buffer.slice(0, this.columns * this.rows);

  if (this.buffer.length !== this.columns * this.rows)
    console.log('bug');
};

ScreenBuffer.prototype.deleteLines = function (args_str) {
  var num = +(args_str || '1');

  this.buffer.splice(this.cursor_y * this.columns, num * this.columns);
  this.buffer = this.buffer.concat(Array.from(Array(num * this.columns), () => new Cell()));

  if (this.buffer.length !== this.columns * this.rows)
    console.log('bug');
};

ScreenBuffer.prototype.dispatchCommand = function (letter, args_str) {
  switch (letter) {
  case 'G':
    this.cursorHorizontalAbsolute(args_str);
    break;
  case 'H':
    this.cursorPosition(args_str);
    break;
  case 'I':
    this.tabStopForward(args_str);
    break;
  case 'Z':
    this.tabStopBackward(args_str);
    break;
  case 'J':
    this.eraseDisplay(args_str);
    break;
  case 'm':
    this.selectGraphicRendition(args_str);
    break;
  case 'K':
    this.eraseInLine(args_str);
    break;
  case 'A':
    this.cursorUp(args_str);
    break;
  case 'B':
    this.cursorDown(args_str);
    break;
  case 'C':
    this.cursorForward(args_str);
    break;
  case 'D':
    this.cursorBackward(args_str);
    break;
  case 'P':
    this.deleteCharacters(args_str);
    break;
  case 'X':
    this.eraseCharacters(args_str);
    break;
  case 'd':
    this.cursorToLine(args_str);
    break;
  case 'n':
    this.deviceStatusReport(args_str);
    break;
  case '@':
    this.insertBlankCharacters(args_str);
    break;
  case 'L':
    this.insertLines(args_str);
    break;
  case 'M':
    this.deleteLines(args_str);
    break;
  case 'b':
    this.repeatLastCharacter(args_str);
    break;
  default:
    console.log(`unknown command letter ${letter} args ${args_str}`);
  }
  return this.fc_normal;
};

ScreenBuffer.prototype.operatingSystemCommand = function (arg_str) {
  var args = arg_str.split(/;/);

  if (args[0] === '0') { // set title bar
    this.title = String(args[1]);
  } else {
    console.log('unknown OSC');
  }
};

ScreenBuffer.prototype.fc_startOperatingSystemCommand = function (c) {
  var args = '';
  function parsingOperatingSystemCommand(c) {
    if (c === '\x07') { // BEL
      this.operatingSystemCommand(args);
      return this.fc_normal;
    } else {
      args += c;
      return parsingOperatingSystemCommand;
    }
  }
  return parsingOperatingSystemCommand.call(this, c);
};

ScreenBuffer.prototype.fc_esc = function (c) {
  if (c === '[') {
    return this.fc_controlSequenceIntroduced;
  } else if (c === ']') {
    return this.fc_startOperatingSystemCommand;
  } else {
    console.log(`got ${c} while expecting [`);
    return this.fc_normal;
  }
};

ScreenBuffer.prototype.feedCharacter = function (character) {
  this.interpretFn = this.interpretFn(character);
};

ScreenBuffer.prototype.feed = function (data) {
  for (var char of data) {
    this.feedCharacter(char);
  }
};

module.exports = {
  ScreenBuffer: ScreenBuffer
};
