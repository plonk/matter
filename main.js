'use strict';

const {app, BrowserWindow, Menu, ipcMain} = require('electron');
const {version} = require('./version');

let mainWindow;

function createWindow(commandLine) {
  mainWindow = new BrowserWindow({ width: 1150, height: 650 });
  mainWindow.loadURL(`file://${__dirname}/index.html`);
  mainWindow.commandLine = commandLine;
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.on('resize', (e) => {
    mainWindow.webContents.executeJavaScript('fitScreen();');
  });
  mainWindow.on('focus', (c) => {
    mainWindow.webContents.focus();
  });
}

function printVersion() {
  process.stdout.write('matter ' + version + '\n');
}

function printUsage() {
  process.stdout.write('matter [OPTIONS] [-e COMMAND ARGS...] [COMMAND]\n');
  process.stdout.write('\t-version\n');
  process.stdout.write('\t-help\n');
  process.stdout.write('\t-e COMMAND ARGS\n');
}

var options = {};

function processCommandLineArguments() {
  var argv = process.argv.slice(2);

  for (var i = 0; i < argv.length; i++) {
    if (argv[i] === '-version') {
      printVersion();
      process.exit(0);
    } else if (argv[i] === '-help') {
      printUsage();
      process.exit(0);
    } else if (argv[i] === '-e') {
      options['command'] = argv.slice(i + 1);
      break;
    } else {
      options['command'] = [argv[i]];
      break;
    }
  }

  if (!options['command']) {
    var shell = process.env['SHELL'] || '/bin/sh'
    options['command'] = [shell];
  }
}

processCommandLineArguments();

app.on('ready', () => {
  Menu.setApplicationMenu(menu);
  createWindow(options['command']);
  // mainWindow.webContents.openDevTools()
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin')
    app.quit();
});

app.on('activate', () => {
  if (mainWindow === null)
    createWindow(options['command']);
});

ipcMain.on('adjust-window-height', (sender, height) => {
  if (height !== mainWindow.getSize()[1]) {
    mainWindow.setSize(mainWindow.getSize()[0], height)
  }
});

ipcMain.on('adjust-window-width', (sender, width) => {
  if (width !== mainWindow.getSize()[0]) {
    mainWindow.setSize(width, mainWindow.getSize()[1]);
  }
});

// メニュー情報の作成
const template = [
  {
    label: 'ファイル',
    submenu: [
      {
        label: '終了',
        accelerator: 'Control+Q',
        click(item, focusedWindow) {
          app.quit()
        }
      }
    ]
  },
  {
    label: '編集',
    submenu: [
      {
        label: 'コピー',
        click(item, focusedWindow) {
          focusedWindow.webContents.executeJavaScript('copy();')
        }
      },
      {
        label: '貼り付け',
        click(item, focusedWindow) {
          focusedWindow.webContents.executeJavaScript('paste();')
        }
      },
      { type: 'separator' },
      {
        label: 'テキスト入力',
        click(item, focusedWindow) {
          focusedWindow.webContents.executeJavaScript('showInputModal();');
        }
      },
    ]
  },
  {
    label: '表示',
    submenu: [
      {
        label: 'DevTools 切り替え',
        accelerator: 'F12',
        click(item, focusedWindow) {
          focusedWindow.toggleDevTools()
        }
      },
      { type: 'separator' },
      {
        label: '文字の大きさ',
        submenu: [
          {
            label: '特大',
            type: 'radio',
            click(item, focusedWindow) {
              focusedWindow.webContents.executeJavaScript('changeFontSize(32)');
            }
          },
          {
            label: '大',
            type: 'radio',
            click(item, focusedWindow) {
              focusedWindow.webContents.executeJavaScript('changeFontSize(20)');
            }
          },
          {
            label: '中',
            type: 'radio',
            checked: true,
            click(item, focusedWindow) {
              focusedWindow.webContents.executeJavaScript('changeFontSize(16)');
            }
          },
          {
            label: '小',
            type: 'radio',
            click(item, focusedWindow) {
              focusedWindow.webContents.executeJavaScript('changeFontSize(12)');
            }
          },
          {
            label: '極小',
            type: 'radio',
            click(item, focusedWindow) {
              focusedWindow.webContents.executeJavaScript('changeFontSize(8)');
            }
          },
        ]
      },
      {
        label: '画面反転',
        click(item, focusedWindow) {
          focusedWindow.webContents.executeJavaScript('receiver.reverseScreenMode = !receiver.reverseScreenMode; renderScreen();');
        }
      },
      {
        label: '80x24',
        click(item, focusedWindow) {
          focusedWindow.webContents.executeJavaScript('receiver.setScreenSize(80,24); renderScreen();');
        }
      },
      {
        label: '132x24',
        click(item, focusedWindow) {
          focusedWindow.webContents.executeJavaScript('receiver.setScreenSize(132,24); renderScreen();');
        }
      },
    ]
  },
  {
    label: 'ヘルプ',
    submenu: [
      {
        label: 'バージョン情報',
        click(item, focusedWindow) {
          focusedWindow.webContents.executeJavaScript('showAboutModal();');
        }
      },
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
