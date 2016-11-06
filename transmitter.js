'use strict';

function Transmitter(term) {
  this.term = term;
  this.cursorKeyMode = 'normal';
};

var CHARACTER_TABLE = {
  'Enter'      : '\x0d',
  'Backspace'  : '\x7f',
  'Tab'        : '\x09',
  'ArrowUp'    : '\x1b[A',
  'ArrowDown'  : '\x1b[B',
  'ArrowRight' : '\x1b[C',
  'ArrowLeft'  : '\x1b[D',
  'Escape'     : '\x1b',

  'F1'         : '\x1bOP',
  'F2'         : '\x1bOQ',
  'F3'         : '\x1bOR',
  'F4'         : '\x1bOS',

  'F5'         : '\x1b[15~',
  'F6'         : '\x1b[17~',
  'F7'         : '\x1b[18~',
  'F8'         : '\x1b[19~',

  'F9'         : '\x1b[20~',
  'F10'        : '\x1b[21~',
  'F11'        : '\x1b[23~',
  'F12'        : '\x1b[24~',

  'Insert'     : '\x1b[2~',
  'Delete'     : '\x1b[3~',
  'Home'       : '\x1b[1~',
  'End'        : '\x1b[4~',
  'PageUp'     : '\x1b[5~',
  'PageDown'   : '\x1b[6~',
};

var APPLICATION_FUNCTION_KEY_TABLE = {
  'ArrowUp'    : '\x1bOA',
  'ArrowDown'  : '\x1bOB',
  'ArrowRight' : '\x1bOC',
  'ArrowLeft'  : '\x1bOD',
};

Transmitter.prototype.toCharacter = function (key, ctrlKey, altKey) {
  if (altKey) {
    return "\x1b" + this.toCharacter(key, ctrlKey, false);
  } else if (ctrlKey) {
    var char = this.toCharacter(key, false, false).toUpperCase();
    if (char.length === 1 && ord(char) >= 0x40 && ord(char) <= 0x5f) {
      return chr(ord(char) - 0x40);
    } else if (char === '/') {
      return '\x1f'; // ^_
    } else if (char === '~') {
      return '\x1e'; // ^^
    } else if (char === ' ') {
      return '\x00';
    } else {
      return "";
    }
  } else {
    if (key.length === 1) {
      return key;
    } else if (this.cursorKeyMode === 'application' &&
               APPLICATION_FUNCTION_KEY_TABLE[key] !== undefined) {
      return APPLICATION_FUNCTION_KEY_TABLE[key];
    } else if (CHARACTER_TABLE[key] !== undefined) {
      return CHARACTER_TABLE[key];
    } else {
      return "";
    }
  }
};

Transmitter.prototype.typeIn = function (ev) {
  if (ev.key === 'Control' || ev.key === 'Shift' || ev.key === 'Alt')
    return;

  var str = this.toCharacter(ev.key, ev.ctrlKey, ev.altKey);
  if (str.length !== 0)
    this.term.write(str);
};

Transmitter.prototype.paste = function (text) {
  this.term.write(text);
}

module.exports = { Transmitter: Transmitter };
