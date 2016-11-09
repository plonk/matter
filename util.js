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

module.exports = {
  orElse: orElse,
  orElseGet: orElseGet,
  ord: ord,
  chr: chr,
  escapeHtml: escapeHtml,
  padLeft: padLeft,
  inspect: inspect,
  arrayUniq: arrayUniq,
  setUnion: setUnion,
};

