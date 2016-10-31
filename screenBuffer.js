'use strict';

// グラフィック属性。文字の修飾状態。
function GraphicAttrs() {
  // 色インデックスで指定するのはよくないな。
  this.reset();
}

const GraphicAttrs_FIELDS = ['textColor', 'backgroundColor', 'bold', 'italic', 'blink', 'fastBlink', 'fraktur', 'crossedOut', 'underline', 'faint', 'conceal', 'reverseVideo']

GraphicAttrs.prototype.reset = function () {
  this.textColor = null;
  this.backgroundColor = null;
  this.bold = false;
  this.italic = false;
  this.blink = false;
  this.fastBlink = false;
  this.fraktur = false;
  this.crossedOut = false;
  this.underline = false;
  this.faint = false;
  this.conceal = false;
  this.reverseVideo = false;
};

GraphicAttrs.prototype.clone = function () {
  var res = new GraphicAttrs();
  for (var attr of GraphicAttrs_FIELDS) {
    res[attr] = this[attr];
  }
  return res;
};

GraphicAttrs.prototype.equals = function (other) {
  for (var attr of GraphicAttrs_FIELDS) {
    if (this[attr] !== other[attr]) {
      return false;
    }
  }
  return true;
};

// 文字セル。
function Cell() {
  this.character = ' ';
  this.broken = false;
  this.attrs = new GraphicAttrs();
}

Cell.prototype.clone = function () {
  var res = new Cell();
  res.character = this.character;
  res.broken = this.broken;
  res.attrs = this.attrs.clone();
  return res;
};

Cell.prototype.equals = function (other) {
  return this.character === other.character &&
    this.broken === other.broken &&
    this.attrs.equals(other.attrs);
};

function createArrayThus(length, fn) {
  var res = [];
  for (var i = 0; i < length; i++) {
    res.push(fn(i));
  }
  return res;
}


function Row(length) {
  this.length = length;
  this._type = 'normal';
  this.array = createArrayThus(length, () => new Cell());
}

const ROW_TYPES = ['normal', 'double-width', 'top-half', 'bottom-half'];

Row.prototype.setType = function (type) {
  if (!ROW_TYPES.includes(type)) throw RangeError('normal, double-width, top-half, bottom-half');

  this._type = type;
};

Row.prototype.getType = function () {
  return this._type;
}

Row.prototype.checkInRange = function (index) {
  if (!Number.isInteger(index))
    throw TypeError('not an integer');

  if (index < 0 || index >= this.columns)
    throw RangeError('index');
};

Row.prototype.getCellAt = function (index) {
  this.checkInRange(index);

  return this.array[index];
};

Row.prototype.setCellAt = function (index, cell) {
  this.checkInRange(index);

  this.array[index] = cell;
};

// スクリーンバッファー。文字セルの二次元配列のようなもの。
function ScreenBuffer(columns, rows) {
  if (columns <= 0) throw RangeError('columns');
  if (rows <= 0) throw RangeError('rows');
  this.columns = columns;
  this.rows = rows;
  this.buffer = createArrayThus(this.rows, () => new Row(this.columns));
}

ScreenBuffer.prototype.getCellAt = function (y, x) {
  if (!Number.isInteger(x)) throw TypeError('x not an integer');
  if (!Number.isInteger(y)) throw TypeError('y not an integer');
  if (x < 0 || x >= this.columns) throw RangeError('x');
  if (y < 0 || y >= this.rows) throw RangeError('y');

  return this.buffer[y].getCellAt(x);
};

ScreenBuffer.prototype.setCellAt = function (y, x, cell) {
  if (!Number.isInteger(x)) throw TypeError('x not an integer');
  if (!Number.isInteger(y)) throw TypeError('y not an integer');
  if (x < 0 || x >= this.columns) throw RangeError('x');
  if (y < 0 || y >= this.rows) throw RangeError('y');
  // TODO: cell の型チェック?

  this.buffer[y].setCellAt(x, cell);
}

ScreenBuffer.prototype.getCellAtOffset = function (offset) {
  if (!Number.isInteger(offset)) throw TypeError('not an integer');
  if (offset < 0 || offset >= this.rows * this.columns) throw RangeError('offset');

  var y = Math.floor(offset / this.columns);
  var x = offset % this.columns;
  return this.buffer[y].getCellAt(x);
};

ScreenBuffer.prototype.setCellAtOffset = function (offset, cell) {
  if (!Number.isInteger(offset)) throw TypeError('not an integer');
  if (offset < 0 || offset >= this.rows * this.columns) throw RangeError('offset');

  var y = Math.floor(offset / this.columns);
  var x = offset % this.columns;
  this.buffer[y].setCellAt(x, cell);
};

function spliceArray(ary, start, deleteCount, ary2) {
  var removed = Array.prototype.splice.apply(ary, [start, deleteCount].concat(ary2));
  return removed;
};

// 範囲 は [y1, y2]。y2を含む。
ScreenBuffer.prototype.scrollDown = function (y1, y2, nlines) {
  this.buffer.copyWithin(y1 + nlines, y1, y2 - nlines + 1);
  for (var i = y1; i < y1 + nlines; i++) {
    this.buffer[i] = new Row(this.columns);
  }
};

// METHOD: scrollUp(y1, y2, nlines)
ScreenBuffer.prototype.scrollUp = function (y1, y2, nlines) {
  this.buffer.copyWithin(y1, y1 + nlines, y2 + 1);
  for (var i = y2 - nlines + 1; i < y2 + 1; i++) {
    this.buffer[i] = new Row(this.columns);
  }
};

ScreenBuffer.prototype.getLine = function (index) {
  // TODO: 引数チェック
  return this.buffer[index];
}

ScreenBuffer.prototype.clone = function () {
  var newBuffer = new ScreenBuffer(this.columns, this.rows);

  for (var y = 0; y < this.rows; y++) {
    for (var x = 0; x < this.columns; x++) {
      newBuffer.setCellAt(y, x, this.getCellAt(y, x).clone());
    }
  }

  return newBuffer;
};

module.exports = {
  GraphicAttrs: GraphicAttrs,
  Cell: Cell,
  ScreenBuffer: ScreenBuffer,
};
