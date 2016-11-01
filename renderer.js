'use strict';

var pty = require('pty');
var {ipcRenderer, remote} = require('electron')
var {Receiver}    = require('./receiver')
var {Transmitter} = require('./transmitter');
var {withDefault} = require('./util');

// -----------

function ord(str) {
  return str.codePointAt(0);
}

function chr(codePoint) {
  return String.fromCodePoint(codePoint);
}

// -----------

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function colorName(index) {
  return ['#303030', '#be1137', '#29732c', '#c95c26', '#2a5aa2', '#cd3a93', '#078692', '#d0d0d0'][index];
  // return ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'][index];
}

function toFraktur (char) {
  if (char.length !== 1)
    return char;

  var fraktur = ['𝔄', '𝔅', 'ℭ', '𝔇', '𝔈', '𝔉', '𝔊', 'ℌ', 'ℑ', '𝔍', '𝔎', '𝔏', '𝔐', '𝔑', '𝔒', '𝔓', '𝔔', 'ℜ', '𝔖', '𝔗', '𝔘', '𝔙', '𝔚', '𝔛', '𝔜', 'ℨ',
                 '𝔞', '𝔟', '𝔠', '𝔡', '𝔢', '𝔣', '𝔤', '𝔥', '𝔦', '𝔧', '𝔨', '𝔩', '𝔪', '𝔫', '𝔬', '𝔭', '𝔮', '𝔯', '𝔰', '𝔱', '𝔲', '𝔳', '𝔴', '𝔵', '𝔶', '𝔷'];
  var normal = "ABCDEFGHIJKLMNOPQRSTUVWXYZ" + "abcdefghijklmnopqrstuvwxyz";
  var index = normal.indexOf(char);

  if (index === -1) {
    return char;
  } else {
    return fraktur[index];
  }
}

function updateRowAttributes() {
  for (var y = 0; y < receiver.rows; y++) {
    var row = $(`#row-${y}`);
    row.removeClass();
    row.addClass('row-' + receiver.buffer.getLine(y).getType());
  }
}

function renderScreen(changedCells) {
  // rowの更新。
  updateRowAttributes();

  // cellの更新。
  var defaultTextColor       = receiver.getDefaultTextColor();
  var defaultBackgroundColor = receiver.getDefaultBackgroundColor();

  for (var indices of changedCells) {
    var y = indices[0];
    var x = indices[1];
    var cell = receiver.buffer.getCellAt(y, x);
    var char = (cell.character === ' ') ? '\xa0' : cell.character;
    char = emojione.unicodeToImage(escapeHtml(char));

    var fg_view = $(`#fg-${y}-${x}`);
    var bg_view = $(`#bg-${y}-${x}`);
    var classes = [];

    fg_view.removeClass();
    bg_view.removeClass();

    if (cell.attrs.bold)       classes.push('bold');
    if (cell.attrs.italic)     classes.push('italic');
    if (cell.attrs.blink)      fg_view.addClass('blink');
    if (cell.attrs.fastBlink)  fg_view.addClass('fast-blink');
    if (cell.attrs.fraktur)    { char = toFraktur(char); }
    if (cell.attrs.crossedOut) classes.push('crossed-out');
    if (cell.attrs.underline)  classes.push('underline');
    if (cell.attrs.faint)      classes.push('faint');
    if (cell.attrs.conceal)    classes.push('conceal');

    var fg = withDefault(cell.attrs.textColor, defaultTextColor);
    var bg = withDefault(cell.attrs.backgroundColor, defaultBackgroundColor);
    if (cell.attrs.bold)
      fg += 8;
    if (cell.attrs.reverseVideo) {
      classes.push(`text-color-${bg}`);
      classes.push(`background-color-${fg}`);
    } else {
      classes.push(`text-color-${fg}`);
      classes.push(`background-color-${bg}`);
    }

    bg_view.addClass(classes.join(' '));
    fg_view.html(char);
  }

  $('#screen td').removeClass('cursor');
  if (receiver.isCursorVisible) {
    $(`#bg-${receiver.cursor_y}-${receiver.cursor_x}`).addClass('cursor');
  }
}

function addData(data) {
  var changedCells = receiver.feed(data);
  renderScreen(changedCells);

  var title = document.querySelector('title');
  var altbuf = receiver.alternateScreen ? '[AltBuf]' : '';
  title.text = `matter ${altbuf} - ${receiver.title}`;
  // console.log('rendered');

  adjustWindowSize();
}

function inspect(str) {
  var out = '';

  for (var c of str) {
    var num = ord(c);
    if (num < 0x20) {
      // 制御文字
      out += '^' + chr(num + 0x40);
    } else if (num <= 0x7e) {
      out += c;
    } else if (num === 0x7f) {
      out += '^?'
    } else {
      // ASCIIの範囲外
      out += c;
    }
  }

  return out;
}

function populate(scr, cols, rows) {
  var str = '';

  for (var y = 0; y < rows; y++) {
    str += `<table style="border-spacing: 0"><tr id="row-${y}" style="line-height: 130%">`;
    for (var x = 0; x < cols; x++) {
      str += `<td id="bg-${y}-${x}" style="padding: 0"><span id="fg-${y}-${x}"></span></td>`;
    }
    str += '</tr></table>';
  }
  scr.innerHTML = str;
}

var term = pty.spawn('bash', [], {
  name: 'xterm',
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: process.env
});

term.on('data', function(data) {
  console.log(['output', inspect(data)]);
  addData(data);
});

term.on('close', function () {
  window.close();
});

var screenElt;

var receiver = new Receiver(term.cols, term.rows, {
  write: (data) => term.write(data),
  resize: (cols, rows) => {
    term.resize(cols, rows);
    populate(screenElt, term.cols, term.rows);
  },
  cursorKeyMode: (mode) => {
    transmitter.cursorKeyMode = mode;
  },
  beep: () => {
    new Audio('beep.wav').play();
  }
});

var transmitter = new Transmitter(term);

function adjustWindowSize() {
  var height = $('#screen').height() + 43;
  var browserWindow = remote.getCurrentWindow();

  console.log(height, browserWindow.getSize()[1]);
  if (height > browserWindow.getSize()[1]) {
    // remote.getCurrentWindow().setMinimumSize(desiredWindowWidth, height);
    remote.getCurrentWindow().setSize(browserWindow.getSize()[0], height)
  }
}

var desiredWindowWidth;
var desiredWindowHeight;

window.onload = () => {
  var body = document.querySelector('body');
  body.addEventListener('keydown', (e) => {
    e.preventDefault();

    transmitter.typeIn(e);
  });

  screenElt = document.getElementById('screen');
  populate(screenElt, term.cols, term.rows);
  function allPositions() {
    var res = [];
    for (var y = 0; y < receiver.rows; y++) {
      for (var x = 0; x < receiver.columns; x++) {
        res.push([y, x]);
      }
    }
    return res;
  }
  renderScreen(allPositions());

  desiredWindowWidth = $('#screen table').width() + 18;
  desiredWindowHeight = $('#screen').height() + 43;
  remote.getCurrentWindow().setMinimumSize(desiredWindowWidth, desiredWindowHeight);
  remote.getCurrentWindow().setSize(desiredWindowWidth, desiredWindowHeight)
};
