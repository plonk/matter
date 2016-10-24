var eastasianwidth = require('eastasianwidth');

function ColorInterpreter() {
}

function GraphicAttrs() {
  // 色インデックスで指定するのはよくないな。
  this.reset();
  // this.textColor = 0;
  // this.backgroundColor = 7;
  // this.bold = false;
}

GraphicAttrs.prototype.reset = function () {
  this.textColor = 0;
  this.backgroundColor = 7;
  this.bold = false;
};  

GraphicAttrs.prototype.clone = function () {
  var res = new GraphicAttrs();
  for (var attr of ['textColor', 'backgroundColor', 'bold']) {
    res[attr] = this[attr];
  }
  return res;
};  

function Cell() {
  this.foreground = 0;
  this.background = 0;
  this.character = '';
  this.broken = false;
  this.attrs = new GraphicAttrs();
}

function ScreenBuffer(columns, rows) {
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

// カーソル位置はオフセットで保待したほうが簡単な気がしてきた。

// 行末に文字を追加しても、次の行にいっちゃいけないんだよなぁ。むずかしい。
// 画面の右下のセルに文字を表示しても、画面がスクロールしてはいけない。
// どうやって実装するんだろう。

// ^[ [ H がカーソル (0,0) で、^[ [ 2 J が画面クリアらしい。

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
  } else {
    // 文字の追加。
    var cell = this.buffer[this.cursorOffset()];
    cell.attrs = this.graphicAttrs.clone();
    cell.character = c;
    this.advanceCursor();
  }
  return ScreenBuffer.prototype.fc_normal;
};

// 画面のクリア。カーソル位置はそのまま。
ScreenBuffer.prototype.clear = function () {
  this.buffer = Array.from(Array(this.columns * this.rows), () => new Cell());  
};

ScreenBuffer.prototype.fc_controlSequenceIntroduced = function (c) {
  var args = '';
  function parsingControlSequence(c) {
    if (/^[a-zA-Z]$/.exec(c)) { // a letter
      this.dispatchCommand(c, args);
      return this.fc_normal;
    } else if (/^[0-9]$/.exec(c) || c === ';') {
      args += c;
      return parsingControlSequence;
    } else {
      console.log(`unexpected character ${c}`);
      return this.fc_normal;
    }
  }
  return parsingControlSequence.call(this, c);
};


ScreenBuffer.prototype.cursorPosition = function (args_str) {
  var args = args_str.split(/;/);
  var y = (args[0] || '1') - 1;
  var x = (args[1] || '1') - 1;

  this.cursor_y = y;
  this.cursor_x = x;
};

ScreenBuffer.prototype.eraseDisplay = function (args_str) {
  switch (args_str) {
  case '0':
  case '1':
    console.log(`ED ${args_str} unimplemented`);
    break;
  case '2':
    this.clear();
    break;
  default:
    console.log('Error: ED ${args_str}');
    break;
  }
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
    } else if (arg >= 30 && arg <= 37) {
      this.graphicAttrs.textColor = arg - 30;
      i++;
    } else if (arg >= 40 && arg <= 47) {
      this.graphicAttrs.backgroundColor = arg - 40;
      i++;
    } else {
      console.log(`unknown SGR arg ${args[i]}`);
      return;
    }
  }
};

ScreenBuffer.prototype.dispatchCommand = function (letter, args_str) {
  switch (letter) {
  case 'H':
    this.cursorPosition(args_str);
    break;
  case 'J':
    this.eraseDisplay(args_str);
    break;
  case 'm':
    this.selectGraphicRendition(args_str);
    break;
  default:
    console.log(`unknown command letter ${letter}`);
  }
  return this.fc_normal;
};
  // if (c === 'H') {
  //   return 
  // } else if (c === '2') {
  //   return function (c) {
  //     if (c === 'J') {
  //       this.clear();
  //       return this.fc_normal;
  //     } else {
  //       console.log(`got ${c} while expecting J`);
  //       return this.fc_normal;
  //     }
  //   };
  // } else {
  //   console.log(`got ${c} while expecting H or J`);
  //   return this.fc_normal;
  // }

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
