'use strict';

var pty = require('pty');
var {ipcRenderer} = require('electron')
var {Receiver} = require('./receiver')

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

function withDefault(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  } else {
    return value;
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

  $('#screen div').removeClass('cursor');
  if (receiver.isCursorVisible) {
    $(`#bg-${receiver.cursor_y}-${receiver.cursor_x}`).addClass('cursor');
  }
}

function addData(data) {
  var changedCells = receiver.feed(data);
  renderScreen(changedCells);

  var title = document.querySelector('title');
  title.text = receiver.title;
  // console.log('rendered');
}

// Dec Hex    Dec Hex    Dec Hex  Dec Hex  Dec Hex  Dec Hex   Dec Hex   Dec Hex
//   0 00 NUL  16 10 DLE  32 20    48 30 0  64 40 @  80 50 P   96 60 `  112 70 p
//   1 01 SOH  17 11 DC1  33 21 !  49 31 1  65 41 A  81 51 Q   97 61 a  113 71 q
//   2 02 STX  18 12 DC2  34 22 "  50 32 2  66 42 B  82 52 R   98 62 b  114 72 r
//   3 03 ETX  19 13 DC3  35 23 #  51 33 3  67 43 C  83 53 S   99 63 c  115 73 s
//   4 04 EOT  20 14 DC4  36 24 $  52 34 4  68 44 D  84 54 T  100 64 d  116 74 t
//   5 05 ENQ  21 15 NAK  37 25 %  53 35 5  69 45 E  85 55 U  101 65 e  117 75 u
//   6 06 ACK  22 16 SYN  38 26 &  54 36 6  70 46 F  86 56 V  102 66 f  118 76 v
//   7 07 BEL  23 17 ETB  39 27 '  55 37 7  71 47 G  87 57 W  103 67 g  119 77 w
//   8 08 BS   24 18 CAN  40 28 (  56 38 8  72 48 H  88 58 X  104 68 h  120 78 x
//   9 09 HT   25 19 EM   41 29 )  57 39 9  73 49 I  89 59 Y  105 69 i  121 79 y
//  10 0A LF   26 1A SUB  42 2A *  58 3A :  74 4A J  90 5A Z  106 6A j  122 7A z
//  11 0B VT   27 1B ESC  43 2B +  59 3B ;  75 4B K  91 5B [  107 6B k  123 7B {
//  12 0C FF   28 1C FS   44 2C ,  60 3C <  76 4C L  92 5C \  108 6C l  124 7C |
//  13 0D CR   29 1D GS   45 2D -  61 3D =  77 4D M  93 5D ]  109 6D m  125 7D }
//  14 0E SO   30 1E RS   46 2E .  62 3E >  78 4E N  94 5E ^  110 6E n  126 7E ~
//  15 0F SI   31 1F US   47 2F /  63 3F ?  79 4F O  95 5F _  111 6F o  127 7F DEL

var CHARACTER_TABLE = {
  'Enter'      : '\x0d',
  'Delete'     : '\x1b[3~',
  'Backspace'  : '\x7f',
  'Tab'        : '\x09',
  'ArrowUp'    : '\x1b[A',
  'ArrowDown'  : '\x1b[B',
  'ArrowRight' : '\x1b[C',
  'ArrowLeft'  : '\x1b[D',
  'Escape'     : '\x1b',
};

function toCharacter(key, ctrlKey, altKey) {
  if (altKey) {
    return "\x1b" + toCharacter(key, ctrlKey, false);
  } else if (ctrlKey) {
    var char = toCharacter(key, false, false).toUpperCase();
    if (char.length === 1 && ord(char) >= 0x30 && ord(char) <= 0x5f) {
      return chr(ord(char) - 0x40);
    } else {
      return "";
    }
  } else {
    if (key.length === 1) {
      return key;
    } else if (CHARACTER_TABLE[key] !== undefined) {
      return CHARACTER_TABLE[key];
    } else {
      return "";
    }
  }
  throw 'unreachable';
}

function typeIn(ev) {
  if (ev.key === 'Control' || ev.key === 'Shift' || ev.key === 'Alt')
    return;

  var str = toCharacter(ev.key, ev.ctrlKey, ev.altKey);
  // console.log(inspect(str));
  if (str.length !== 0)
    term.write(str);
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
    str += `<div id="row-${y}">`;
    for (var x = 0; x < cols; x++) {
      str += `<div id="bg-${y}-${x}" style="overflow: visible; line-height: 1.15em; height: 1.15em; vertical-align: middle; display: inline-block"><span id="fg-${y}-${x}"></span></div>`;
    }
    str += '</div>';
  }
  scr.innerHTML = str;
}

var term = pty.spawn('bash', [], {
  name: 'xterm-color',
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
  }
});

window.onload = () => {
  var body = document.querySelector('body');
  body.addEventListener('keydown', (e) => {
    e.preventDefault();
    typeIn(e);
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
};
