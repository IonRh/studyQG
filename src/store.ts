// 存储各种数据
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { config } from './config';

// 检查是否在主进程中运行
const isMainProcess = process && process.type === 'browser';
const isRendererProcess = !isMainProcess;

// 创建兼容的存储访问接口
const storage = {
  getItem: (key: string): string | null => {
    if (isRendererProcess && typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (isRendererProcess && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  }
};

// 创建隔离存储
const createIsolatedStorage = () => {
  const instanceId = config.instanceId;
  console.log(`获取实例ID: ${instanceId}`);
  
  // 创建临时目录
  const appTempDir = path.join(os.tmpdir(), `studyxixi-${instanceId}`);
  
  // 检查临时目录是否已存在
  if (fs.existsSync(appTempDir)) {
    console.log(`实例临时目录已存在: ${appTempDir}`);
  } else {
    try {
      fs.mkdirSync(appTempDir, { recursive: true });
      // console.log(`创建实例临时目录: ${appTempDir}`);
    } catch (error) {
      console.error(`创建实例临时目录失败: ${appTempDir}`, error);
    }
  }
  
  return {
    instanceId,
    tempDir: appTempDir,
  };
};

// 初始化隔离存储
const isolatedStorage = config.isolatedStorage ? createIsolatedStorage() : null;

type stateTypes = {
  splashWaiting: boolean,
  articleChannels: any[];
  videoChannels: any[];
  userInfo: any;
  isolatedStorage: any;
  // PushPush 配置
  pushpushConfig: {
    token: string;
    enabled: boolean;
    endpoint: string;
    autoPushTime: string;
    dailyPushEnabled: boolean;
  };
};

const state: stateTypes = {
  splashWaiting: false,
  articleChannels: [],
  videoChannels: [],
  userInfo: Object.create(null),
  isolatedStorage: isolatedStorage,
  // 初始化 PushPush 配置（从localStorage获取初始值或使用默认值）
  pushpushConfig: {
    token: storage.getItem('pushpush-token') || '',
    enabled: storage.getItem('pushpush-enabled') === 'true',
    endpoint: storage.getItem('pushplus-endpoint') || 'https://www.pushplus.plus/send',
    autoPushTime: storage.getItem('auto-push-time') || '08:00',
    dailyPushEnabled: storage.getItem('daily-push-enabled') === 'true',
  },
};

export const splashComplete = () => {
  state.splashWaiting = true;
}

export const getSplashIsComplete = () => {
  return state.splashWaiting;
}

export const setArticleChannels = (channels: [] = []) => {
  state.articleChannels = [...channels];
};

export const setVideoChannels = (channels: [] = []) => {
  state.videoChannels = [...channels];
};

export const getArticleChannels = () => {
  return state.articleChannels;
};

export const getVideoChannels = () => {
  return state.videoChannels;
};

export const setUserInfo = (userInfo: any) => {
  state.userInfo = { ...userInfo };
}

// 获取当前实例ID
export const getInstanceId = () => {
  return state.isolatedStorage ? state.isolatedStorage.instanceId : null;
};

// 获取临时目录
export const getInstanceTempDir = () => {
  return state.isolatedStorage ? state.isolatedStorage.tempDir : os.tmpdir();
};

// PushPush 配置相关方法
export const setPushPushToken = (token: string) => {
  // console.log('设置PushPush Token:', token);
  state.pushpushConfig.token = token;
  // 同时更新 localStorage 以保持兼容性
  storage.setItem('pushpush-token', token);
};

export const getPushPushToken = () => {
  const token = state.pushpushConfig.token;
  // console.log('从store获取PushPush Token:', token);
  return token;
};

export const setPushPushEnabled = (enabled: boolean) => {
  // console.log('设置PushPush Enabled:', enabled);
  state.pushpushConfig.enabled = enabled;
  // 同时更新 localStorage 以保持兼容性
  storage.setItem('pushpush-enabled', enabled.toString());
};

export const getPushPushEnabled = () => {
  const enabled = state.pushpushConfig.enabled;
  // console.log('从store获取PushPush Enabled:', enabled);
  return enabled;
};

export const setPushPushEndpoint = (endpoint: string) => {
  state.pushpushConfig.endpoint = endpoint;
  // 同时更新 localStorage 以保持兼容性
  storage.setItem('pushplus-endpoint', endpoint);
};

export const getPushPushEndpoint = () => {
  return state.pushpushConfig.endpoint;
};

export const setAutoPushTime = (time: string) => {
  state.pushpushConfig.autoPushTime = time;
  // 同时更新 localStorage 以保持兼容性
  storage.setItem('auto-push-time', time);
};

export const getAutoPushTime = () => {
  return state.pushpushConfig.autoPushTime;
};

export const setDailyPushEnabled = (enabled: boolean) => {
  state.pushpushConfig.dailyPushEnabled = enabled;
  // 同时更新 localStorage 以保持兼容性
  storage.setItem('daily-push-enabled', enabled.toString());
};

export const getDailyPushEnabled = () => {
  return state.pushpushConfig.dailyPushEnabled;
};

// 递归删除目录及其所有内容
export const removeDirectory = (dirPath: string): boolean => {
  try {
    if (!fs.existsSync(dirPath)) {
      return true;
    }

    // 读取目录内容
    let files;
    try {
      files = fs.readdirSync(dirPath);
    } catch (err) {
      console.log(`读取目录失败: ${dirPath}`, err);
      return false;
    }

    // 遍历删除每个文件和子目录
    for (const file of files) {
      const curPath = path.join(dirPath, file);
      
      try {
        // 如果是目录，则递归删除
        if (fs.lstatSync(curPath).isDirectory()) {
          removeDirectory(curPath);
        } else {
          // 删除文件
          try {
            fs.unlinkSync(curPath);
          } catch (err) {
            // 忽略权限错误，Windows上某些文件可能被锁定
            console.log(`删除文件跳过(可能被锁定): ${curPath}`);
          }
        }
      } catch (err) {
        console.log(`处理路径失败，跳过: ${curPath}`);
      }
    }

    // 删除目录本身
    try {
      fs.rmdirSync(dirPath);
    } catch (err) {
      // 目录可能不为空（因为某些文件无法删除），或被锁定
      console.log(`删除目录失败，可能不为空或被锁定: ${dirPath}`);
      return false;
    }
    
    return true;
  } catch (err) {
    console.log(`删除操作出错: ${dirPath}`, err);
    return false;
  }
};

// 清理当前实例的临时目录
export const cleanupInstanceTempDir = (): boolean => {
  if (!state.isolatedStorage) {
    return false;
  }
  
  const tempDir = state.isolatedStorage.tempDir;
  // console.log(`清理实例临时目录: ${tempDir}`);
  return removeDirectory(tempDir);
};

// 清理当前实例的用户数据目录
export const cleanupInstanceUserDataDir = (userDataBasePath: string): boolean => {
  if (!state.isolatedStorage) {
    return false;
  }
  
  const instanceId = state.isolatedStorage.instanceId;
  const userDataDir = path.join(userDataBasePath, instanceId);
  
  if (fs.existsSync(userDataDir)) {
    // console.log(`清理实例用户数据目录: ${userDataDir}`);
    return removeDirectory(userDataDir);
  }
  
  return true;
};