'use strict';

var pty = require('pty');
var {ipcRenderer, remote, clipboard} = require('electron')
var {Receiver}    = require('./receiver')
var {Transmitter} = require('./transmitter');
var {orElse, ord, chr, escapeHtml, padLeft, setUnion} = require('./util');

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

function createBgStartTag(color) {
  return `<span class="background-color-${color}">`;
}

function createFgStartTag(attrs) {
  var classes = '';

  if (attrs.bold)       classes += ' bold';
  if (attrs.italic)     classes += ' italic';
  if (attrs.blink)      classes += ' blink';
  if (attrs.fastBlink)  classes += ' fast-blink';
  if (attrs.crossedOut) classes += ' crossed-out';
  if (attrs.underline)  classes += ' underline';
  if (attrs.faint)      classes += ' faint';
  if (attrs.conceal)    classes += ' conceal';

  var fg = orElse(attrs.textColor, receiver.getDefaultTextColor());
  var bg = orElse(attrs.backgroundColor, receiver.getDefaultBackgroundColor());

  if (attrs.bold)
    fg += 8;

  if (attrs.reverseVideo) {
    classes += ` text-color-${bg}`;
  } else {
    classes += ` text-color-${fg}`;
  }

  return `<span class="${classes}">`;
}

// emojione が U+FE0E と U+FE0F を逆に解釈するので入れ替える。
function swapVariantSelectors(str) {
  return str.replace(/[\uFE0E\uFE0F]/, c => (c == '\uFE0E') ? '\uFE0F' : '\uFE0E');
}

function cursorClass(receiver) {
  var klass = 'cursor';
  if (receiver.reverseScreenMode)
    klass += '-reverse';
  if (receiver.cursorBlink)
    klass += '-blink';
  return klass;
}

function buildRowHtml(y) {
  var str = '';
  var bgColor = null;

  for (var x  = 0; x < receiver.columns; x++) {
    var cell = receiver.buffer.getCellAt(y, x);
    var char = cell.character;

    var newBgColor;
    if (cell.attrs.reverseVideo) {
      newBgColor = orElse(cell.attrs.textColor, receiver.getDefaultTextColor())
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
      var klass = cursorClass(receiver);
      str += `<span class="${klass}">`;
    }
    str += emojione.unicodeToImage(escapeHtml(swapVariantSelectors(char)));
    if (cursor)
      str += '</span>';
    str += '</span>';
  }
  str += '</span>';
  return str;
}

function renderRow(y) {
  var row = $(`#row-${y} > div`);

  row.html(buildRowHtml(y));
}

function formatPosition(y, x) {
  var str_y = padLeft(String(receiver.cursor_y + 1), 2, '0');
  var str_x = padLeft(String(receiver.cursor_x + 1), 3, '0');
  return `(${str_y},${str_x})`;
}

function setWindowTitle() {
  var title = document.querySelector('title');
  var alt = receiver.alternateScreen ? '[AltScr]' : '';
  var pos = formatPosition(receiver.cursor_y, receiver.cursor_x);
  var scrollBack = `${receiver.buffer.getScrollBackOffset()}/${receiver.buffer.getScrollBackBufferLength()}/${receiver.buffer.getScrollBackBufferCapacity()}`;
  title.text = `matter ${alt} ${pos} ${scrollBack} - ${receiver.title}`;
}

function renderScreen() {
  $('#screen').removeClass();
  if (receiver.reverseScreenMode) {
    $('#screen').addClass(`background-color-7`);
  } else {
    $('#screen').addClass(`background-color-0`);
  }

  $('#screen').html(buildScreenHtml());

  setWindowTitle();

  adjustWindowHeight();
  if (needsResize) {
    adjustWindowWidth();
    needsResize = false;
  }
}

function buildRowClasses(y) {
  var str = 'row-' + receiver.buffer.getLine(y).getType();
  if (y === receiver.scrollingRegionTop)
    str += ' row-scroll-region-top';
  if (y === receiver.scrollingRegionBottom)
    str += ' row-scroll-region-bottom';
  return str;
}

function buildScreenHtml() {
  var str = '';

  for (var y = 0; y < receiver.rows; y++) {
    str += `<div id="row-${y}" class="${buildRowClasses(y)}" style="white-space: pre"><div>`;
    str += buildRowHtml(y);
    str += '</div></div>';
  }

  return str;
}

var term = pty.spawn('bash', [], {
  name: 'xterm',
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: process.env
});

term.on('data', function(data) {
  var _data = Array.from(data);
  term.pause();
  function iter(index) {
    while (true) {
      if (index === _data.length) {
        renderScreen();
        term.resume();
        return;
      } else {
        var char = _data[index];

        receiver.feed(char);
        if (receiver.smoothScrollMode && receiver.buffer.scrollPerformed) {
          setTimeout(() => {
            console.log(Date.now());
            renderScreen();
            iter(index + 1);
          }, 0); // どの道、レンダリングに百数十ミリ秒かかるのでタイムアウトを設定しない。
          return;
        } else {
          index += 1;
        }
      }
    }
  }
  iter(0);
});

term.on('close', function () {
  window.close();
});

var needsResize = false;

var receiver = new Receiver(term.cols, term.rows, {
  write: (data) => term.write(data),
  resize: (cols, rows) => {
    term.resize(cols, rows);
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
  renderScreen();
  $('#myModal').modal('hide');
}

function paste() {
  transmitter.paste(clipboard.readText());
  renderScreen();
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
        receiver.scrollBack(1);
        // receiver.scrollBack(Math.floor(receiver.rows/2));
        renderScreen();
      } else if (e.key === 'PageDown' && e.shiftKey){
        receiver.scrollBack(-1);
        // receiver.scrollBack(-Math.floor(receiver.rows/2));
        renderScreen();
      } else {
        transmitter.typeIn(e);
      }
    }
  });

  renderScreen();

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
