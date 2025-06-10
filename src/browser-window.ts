import { BrowserWindow, Menu, app } from 'electron';
import * as path from 'path';
import { homeUrl } from './urls';
import { config } from './config';
import { delay } from './utils';
import { getInstanceId, getInstanceTempDir, cleanupInstanceTempDir, cleanupInstanceUserDataDir, removeDirectory } from './store';
import * as os from 'os';
import * as fs from 'fs';

let win: BrowserWindow = null;
let splash: BrowserWindow;
let userDataBasePath: string = '';

// 防止多实例运行
const gotTheLock = app.requestSingleInstanceLock();

// 如果是第二个实例，则退出
if (!gotTheLock) {
  console.log('应用已经在运行，将启动新实例...');
  // 不直接退出，而是使用新的用户数据目录启动
} else {
  // 监听第二个实例的启动
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    console.log('检测到已有实例运行，但以新实例方式启动');
    // 创建新窗口而不是聚焦已有窗口
    if (!win) {
      createWindow();
    }
  });
}

// 监听应用程序退出事件，清理临时目录
app.on('will-quit', () => {
  console.log('应用程序即将退出，开始清理临时目录...');
  
  // 清理临时目录
  if (config.isolatedStorage) {
    // 首先清理临时目录
    cleanupInstanceTempDir();
    
    // 清理实例ID文件
    try {
      const instanceMarkerPath = path.join(os.tmpdir(), 'studyxixi-current-instance.txt');
      if (fs.existsSync(instanceMarkerPath)) {
        fs.unlinkSync(instanceMarkerPath);
        // console.log('已清理实例ID标记文件');
      }
    } catch (err) {
      console.log('清理实例ID标记文件失败:', err);
    }
    
    // 尝试清理用户数据目录，但不要阻止程序退出
    if (userDataBasePath) {
      try {
        const instanceId = getInstanceId();
        if (instanceId) {
          // console.log(`标记用户数据目录待清理: ${path.join(userDataBasePath, instanceId)}`);
          
          // 创建一个标记文件，用于下次启动时检测和清理
          const markerFilePath = path.join(os.tmpdir(), `cleanup_${instanceId}.txt`);
          fs.writeFileSync(markerFilePath, `${userDataBasePath}|${instanceId}`);
        }
      } catch (err) {
        console.log('标记清理信息失败:', err);
      }
    }
  }
});

const createWindow = () => {
  if (win) return;

  // 检查并清理上次遗留的数据目录
  cleanupPreviousUserData();

  // 设置应用用户数据目录
  if (config.isolatedStorage) {
    const instanceId = getInstanceId();
    // 保存原始用户数据路径
    userDataBasePath = app.getPath('userData');
    const userDataPath = path.join(userDataBasePath, instanceId);
    // console.log(`启动新的应用实例: ${instanceId}`);
    // console.log(`应用数据目录: ${userDataPath}`);
    
    // 确保目录存在
    if (!require('fs').existsSync(userDataPath)) {
      require('fs').mkdirSync(userDataPath, { recursive: true });
    }
    
    // 设置临时数据目录
    app.setPath('userData', userDataPath);
  }

  win = new BrowserWindow({
    width: 800,
    height: 650,
    show: false,
    webPreferences: {
      // 渲染线程使用node
      nodeIntegration: true,
      // 禁用同源策略 (通常用来测试网站)
      webSecurity: false,
      preload: path.join(__dirname, './renderer/preload.js'),
      backgroundThrottling: false,
      webviewTag: true,
    },
  });

  splash = new BrowserWindow({
    width: 800,
    height: 650,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, './splash.js'),
    },
  });

  splash.loadFile(path.join(__dirname, '../splash.html'));

  win.loadURL(homeUrl);

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('closed', () => {
    win = null;
  });

  win.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    win.webContents.loadURL(url);
  });

  if (config.openDevTools) {
    win.webContents.openDevTools();
  }

  // 静音
  win.webContents.audioMuted = config.audioMuted;

  // 初始化菜单栏
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: '加载中...' }]));
};

// 清理上次退出时标记的用户数据目录
const cleanupPreviousUserData = () => {
  try {
    const tempDir = os.tmpdir();
    const files = fs.readdirSync(tempDir);
    
    // 查找清理标记文件
    const cleanupFiles = files.filter(file => file.startsWith('cleanup_') && file.endsWith('.txt'));
    
    for (const file of cleanupFiles) {
      try {
        const filePath = path.join(tempDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const [basePath, instanceId] = content.split('|');
        
        if (basePath && instanceId) {
          const userDataDir = path.join(basePath, instanceId);
          // console.log(`启动时清理上次的用户数据目录: ${userDataDir}`);
          
          // 清理对应的临时目录
          const tempInstanceDir = path.join(tempDir, `studyxixi-${instanceId}`);
          if (fs.existsSync(tempInstanceDir)) {
            // console.log(`清理对应的临时目录: ${tempInstanceDir}`);
            try {
              removeDirectory(tempInstanceDir);
            } catch (err) {
              console.log('清理临时目录失败，继续启动', err);
            }
          }
          
          // 尝试清理目录，但不要因为清理失败而中断启动流程
          try {
            // 正确传递基本路径作为参数
            removeDirectory(userDataDir);
          } catch (err) {
            console.log('清理历史用户数据目录失败，继续启动', err);
          }
        }
        
        // 无论清理成功与否，都删除标记文件
        fs.unlinkSync(filePath);
      } catch (err) {
        console.log(`处理清理标记文件失败: ${file}`, err);
      }
    }
    
    // 清理所有孤立的临时目录（已经没有对应实例的目录）
    const currentInstanceId = config.instanceId;
    const tempInstanceDirs = files.filter(file => 
      file.startsWith('studyxixi-instance_') && 
      !file.includes(currentInstanceId)
    );
    
    for (const dirName of tempInstanceDirs) {
      try {
        const dirPath = path.join(tempDir, dirName);
        // 检查是否是目录
        if (fs.statSync(dirPath).isDirectory()) {
          console.log(`清理孤立的临时目录: ${dirPath}`);
          removeDirectory(dirPath);
        }
      } catch (err) {
        console.log(`处理孤立的临时目录失败: ${dirName}`, err);
      }
    }
  } catch (err) {
    console.log('查找清理标记文件失败', err);
  }
};

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // 在 macOS 上，除非用户用 CMD + D 确定退出
  // 否则绝大部分应用及其菜单栏会保持激活
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // 在macOS上，当单击dock图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.allowRendererProcessReuse = true;

export { win, splash };
