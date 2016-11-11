'use strict';

const {Receiver} = require('./receiver.js');
const {assertEquals} = require('./util.js');

function feedA() {
  var receiver = new Receiver(10, 5, {});

  receiver.feed('a');

  var expectation =
      'a.........\n' +
      '..........\n' +
      '..........\n' +
      '..........\n' +
      '..........\n';

  assertEquals(expectation, receiver.buffer.toString().replace(/ /g, '.'));
}

function feedHiraganaA() {
  var receiver = new Receiver(10, 5, {});

  receiver.feed('あ');

  var expectation =
      'あ........\n' +
      '..........\n' +
      '..........\n' +
      '..........\n' +
      '..........\n';

  assertEquals(expectation, receiver.buffer.toString().replace(/ /g, '.'));
}

function fillLineWithAs() {
  var receiver = new Receiver(10, 5, {});

  receiver.feed('a'.repeat(10));

  var expectation =
      'aaaaaaaaaa\n' +
      '..........\n' +
      '..........\n' +
      '..........\n' +
      '..........\n';

  assertEquals(expectation, receiver.buffer.toString().replace(/ /g, '.'));
  assertEquals(9, receiver.cursor_x);
  assertEquals(0, receiver.cursor_y);

  // line wrap
  receiver.feed('b');
  assertEquals(1, receiver.cursor_x);
  assertEquals(1, receiver.cursor_y);
}

function beepCallback() {
  var called = false;
  var receiver = new Receiver(10, 5, { beep: () => { called = true } });

  assertEquals(false, called);
  receiver.feed('\x07');
  assertEquals(true, called);
}

feedA();
feedHiraganaA();
fillLineWithAs();
beepCallback();
