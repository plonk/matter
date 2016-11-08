'use strict';

var pty = require('pty');
var {ipcRenderer, remote, clipboard} = require('electron')
var {Receiver}    = require('./receiver')
var {Transmitter} = require('./transmitter');
var {orElse, ord, chr, escapeHtml, padLeft} = require('./util');

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
  $(`#row-${receiver.scrollingRegionTop}`).addClass('row-scroll-region-top');
  $(`#row-${receiver.scrollingRegionBottom}`).addClass('row-scroll-region-bottom');
}

function createBgStartTag(color) {
  return `<span class="background-color-${color}">`;
}

function createFgStartTag(attrs) {
  var classes = [];

  if (attrs.bold)       classes.push('bold');
  if (attrs.italic)     classes.push('italic');
  if (attrs.blink)      classes.push('blink');
  if (attrs.fastBlink)  classes.push('fast-blink');
  if (attrs.crossedOut) classes.push('crossed-out');
  if (attrs.underline)  classes.push('underline');
  if (attrs.faint)      classes.push('faint');
  if (attrs.conceal)    classes.push('conceal');

  var fg = orElse(attrs.textColor, receiver.getDefaultTextColor());
  var bg = orElse(attrs.backgroundColor, receiver.getDefaultBackgroundColor());

  if (attrs.bold)
    fg += 8;

  if (attrs.reverseVideo) {
    classes.push(`text-color-${bg}`);
  } else {
    classes.push(`text-color-${fg}`);
  }

  return `<span class="${classes.join(' ')}">`;
}

// emojione が U+FE0E と U+FE0F を逆に解釈するので入れ替える。
function swapVariantSelectors(str) {
  return str.replace(/[\uFE0E\uFE0F]/, c => (c == '\uFE0E') ? '\uFE0F' : '\uFE0E');
}

function renderRow(y) {
  var defaultTextColor       = receiver.getDefaultTextColor();
  var defaultBackgroundColor = receiver.getDefaultBackgroundColor();

  var row = $(`#row-${y} > div`);
  var str = '';
  var bgColor = null;

  for (var x  = 0; x < receiver.columns; x++) {
    var cell = receiver.buffer.getCellAt(y, x);
    var char = cell.character;

    var newBgColor;
    if (cell.attrs.reverseVideo) {
      newBgColor = orElse(cell.attrs.textColor, defaultTextColor)
    } else {
      newBgColor = orElse(cell.attrs.backgroundColor, 'transparent');
    }

    if (bgColor !== newBgColor) {
      if (bgColor !== null) {
        str += "</span>";
      }
      bgColor = newBgColor;
      str += createBgStartTag(bgColor);
    }

    if (cell.attrs.fraktur) {
      char = toFraktur(char);
    }

    var cursor = (y === receiver.cursor_y &&
                  x === receiver.cursor_x &&
                  receiver.isCursorVisible &&
                  receiver.buffer.getScrollBackOffset() === 0);

    str += createFgStartTag(cell.attrs, cursor);
    if (cursor) {
      if (receiver.reverseScreenMode)
        str += '<span class="cursor-reverse">';
      else
        str += '<span class="cursor">';
    }
    str += emojione.unicodeToImage(escapeHtml(swapVariantSelectors(char)));
    if (cursor)
      str += '</span>';
    str += '</span>';
  }
  str += '</span>';
  row.html(str);
}

function formatPosition(y, x) {
  var str_y = padLeft(String(receiver.cursor_y + 1), 2, '0');
  var str_x = padLeft(String(receiver.cursor_x + 1), 3, '0');
  return `(${str_y},${str_x})`;
}

function renderScreen(changedRows) {
  $('#screen').removeClass();
  if (receiver.reverseScreenMode) {
    $('#screen').addClass(`background-color-7`);
  } else {
    $('#screen').addClass(`background-color-0`);
  }

  // rowの更新。
  updateRowAttributes();

  // cellの更新。

  for (var y of changedRows) {
    renderRow(y);
  }

  var title = document.querySelector('title');
  var alt = receiver.alternateScreen ? '[AltScr]' : '';
  var pos = formatPosition(receiver.cursor_y, receiver.cursor_x);
  var scrollBack = `${receiver.buffer.getScrollBackOffset()}/${receiver.buffer.getScrollBackBufferLength()}/${receiver.buffer.getScrollBackBufferCapacity()}`;
  title.text = `matter ${alt} ${pos} ${scrollBack} - ${receiver.title}`;

  adjustWindowHeight();
  if (needsResize) {
    adjustWindowWidth();
    needsResize = false;
  }
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
    str += `<div id="row-${y}" style="white-space: pre"><div>`;
    str += '</div></div>';
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

function arrayUniq(arr) {
  if (arr.length === 0) {
    return arr;
  } else {
    var first = arr[0];

    return [first].concat(
      arrayUniq(arr.slice(1).filter(elt => elt !== first))
    );
  }
}

function setUnion(a, b) {
  var res = new Set(a);
  for (var elt of b) {
    res.add(elt);
  }
  return res;
}

term.on('data', function(data) {
  term.pause();
  var acc = new Set();
  function iter(_data) {
    if (_data.length === 0) {
      acc = setUnion(acc, new Set(receiver.changedRows()));
      renderScreen(acc);
      acc = new Set();
      term.resume();
    } else {
      var char = _data[0];
      var rest = _data.slice(1);

      receiver.feed(char);
      if (receiver.smoothScrollMode && receiver.buffer.scrollPerformed) {
        setTimeout(() => {
          console.log(Date.now());
          acc = setUnion(acc, new Set(receiver.changedRows()));
          renderScreen(acc);
          acc = new Set();
          iter(rest);
        }, 0); // どの道、レンダリングに百数十ミリ秒かかるのでタイムアウトを設定しない。
      } else {
        acc = setUnion(acc, new Set(receiver.changedRows()));
        iter(rest);
      }
    }
  }
  iter(Array.from(data));
});

term.on('close', function () {
  window.close();
});

var screenElt;

var needsResize = false;

var receiver = new Receiver(term.cols, term.rows, {
  write: (data) => term.write(data),
  resize: (cols, rows) => {
    term.resize(cols, rows);
    populate(screenElt, term.cols, term.rows);
    needsResize = true;
  },
  cursorKeyMode: (mode) => {
    transmitter.cursorKeyMode = mode;
  },
  beep: () => {
    new Audio('beep.wav').play();
  }
});

var transmitter = new Transmitter(term);

function adjustWindowHeight() {
  var height = $('#screen').height() + 25;

  ipcRenderer.send('adjust-window-height', height);
}

function adjustWindowWidth() {
  var minWidth = 1000;

  $('#screen #row-0 div').each(function () {
    minWidth = Math.min($(this).width(), minWidth);
  });

  ipcRenderer.send('adjust-window-width', minWidth);
}
var modalShown = false;

function showModal() {
  $('#myModal').modal('show');
}

function enterText() {
  var text = $('#text')[0].value;
  if (text === '') return;

  transmitter.paste(text);
  renderScreen(receiver.changedRows());
  $('#myModal').modal('hide');
}

function paste() {
  transmitter.paste(clipboard.readText());
  renderScreen(receiver.changedRows());
}

function copy() {
  clipboard.writeText(clipboard.readText('selection'));
}

window.onload = () => {
  var body = document.querySelector('body');
  body.addEventListener('keydown', (e) => {
    if (!modalShown) {
      e.preventDefault();

      if (e.key === 'PageUp' && e.shiftKey) {
        receiver.scrollBack(Math.floor(receiver.rows/2));
        renderScreen(receiver.changedRows());
      } else if (e.key === 'PageDown' && e.shiftKey){
        receiver.scrollBack(-Math.floor(receiver.rows/2));
        renderScreen(receiver.changedRows());
      } else {
        transmitter.typeIn(e);
      }
    }
  });

  screenElt = document.getElementById('screen');
  populate(screenElt, term.cols, term.rows);
  renderScreen(receiver.changedRows());

  var desiredWindowWidth = $('#screen #row-0 div').width();
  var desiredWindowHeight = $('#screen').height() + 25;
  remote.getCurrentWindow().setMinimumSize(desiredWindowWidth, desiredWindowHeight);
  remote.getCurrentWindow().setSize(desiredWindowWidth, desiredWindowHeight);

  $('#myModal').on('shown.bs.modal', function () {
    modalShown = true;
    $('#text').focus().val('');
  });
  $('#myModal').on('hidden.bs.modal', function () {
    modalShown = false;
  });
};
