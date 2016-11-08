'use strict';

const {app, BrowserWindow, Menu, ipcMain} = require('electron');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1150, height: 650 });
  mainWindow.loadURL(`file://${__dirname}/index.html`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  Menu.setApplicationMenu(menu);
  createWindow();
  // mainWindow.webContents.openDevTools()
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin')
    app.quit();
});

app.on('activate', () => {
  if (mainWindow === null)
    createWindow();
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
        click: function () {
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
        click: function () {
          BrowserWindow.getFocusedWindow().webContents.executeJavaScript('copy();')
        }
      },
      {
        label: '貼り付け',
        click: function () {
          BrowserWindow.getFocusedWindow().webContents.executeJavaScript('paste();')
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'テキスト入力',
        click: function () {
          BrowserWindow.getFocusedWindow().webContents.executeJavaScript('showModal();');
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
        click: function () {
          BrowserWindow.getFocusedWindow().toggleDevTools()
        }
      },
      {
        label: '画面反転',
        click: function () {
          BrowserWindow.getFocusedWindow().webContents.executeJavaScript('receiver.feed("\\x1b[?5h"); renderScreen(receiver.changedRows());');
        }
      },
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
