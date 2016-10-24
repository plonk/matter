var eastasianwidth = require('eastasianwidth');

function ColorInterpreter() {
}

function Cell() {
  this.foreground = 0;
  this.background = 0;
  this.character = null;
  this.broken = false;
}

function ScreenBuffer(columns, rows) {
  if (columns <= 0) throw RangeError('columns');
  if (rows <= 0) throw RangeError('rows');

  this.columns = columns;
  this.rows = rows;
  this.buffer = new Array(columns * rows).map(() => new Cell());
  this.cursor_x = 0;
  this.cursor_y = 0;
}

ScreenBuffer.prototype.resize = function (columns, rows) {
  throw 'not implemented';
};

ScreenBuffer.prototype.feedCharacter = function (character) {
  this.buffer[0].character = character;
};

ScreenBuffer.prototype.feed = function (data) {
  for (var char of data) {
    this.feedCharacter(char);
  }
};

module.exports = {
  ScreenBuffer: ScreenBuffer
};
