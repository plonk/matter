'use strict';

function orElse(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  } else {
    return value;
  }
}

function orElseGet(value, action) {
  if (value === undefined || value === null) {
    return action();
  } else {
    return value;
  }
}

function ord(str) {
  return str.codePointAt(0);
}

function chr(codePoint) {
  return String.fromCodePoint(codePoint);
}

function escapeHtml(unsafe) {
  return unsafe.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function padLeft(string, length, character) {
  if (Array.from(character).length !== 1) {
    throw new RangeError('character');
  }

  var shortage = Math.max(0, length - string.length);
  return Array(shortage + 1).join(character) + string; 
}

module.exports = {
  orElse: orElse,
  orElseGet: orElseGet,
  ord: ord,
  chr: chr,
  escapeHtml: escapeHtml,
  padLeft: padLeft,
};

