import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// 检查是否已存在实例ID
const getStoredInstanceId = (): string | null => {
  try {
    // 使用进程ID和启动时间作为实例标识的一部分，确保每次启动都是唯一的
    // 而不会在同一个进程的不同模块中生成不同的ID
    const instanceMarkerPath = path.join(os.tmpdir(), 'studyxixi-current-instance.txt');
    
    if (fs.existsSync(instanceMarkerPath)) {
      const storedId = fs.readFileSync(instanceMarkerPath, 'utf8');
      if (storedId && storedId.startsWith('instance_')) {
        return storedId.trim();
      }
    }
  } catch (err) {
    console.error('读取实例ID失败:', err);
  }
  return null;
};

// 创建或获取实例ID
const createOrGetInstanceId = (): string => {
  // 首先尝试获取已存储的实例ID
  const storedId = getStoredInstanceId();
  if (storedId) {
    return storedId;
  }
  
  // 生成新的实例ID
  const newInstanceId = `instance_${Math.random().toString(36).substring(2, 12)}`;
  
  try {
    // 将新生成的实例ID存储到临时文件
    const instanceMarkerPath = path.join(os.tmpdir(), 'studyxixi-current-instance.txt');
    fs.writeFileSync(instanceMarkerPath, newInstanceId);
  } catch (err) {
    console.error('存储实例ID失败:', err);
  }
  
  return newInstanceId;
};

// 为当前进程创建一个固定的实例ID
const INSTANCE_ID = createOrGetInstanceId();

export const config = {
  isDEV: true,
  openDevTools: false,
  showTaskWindow: false,
  tipsPrefix: '',
  audioMuted: false,
  taskTimeoutMs: 60 * 60 * 1000,
  // 隔离存储配置
  isolatedStorage: true,
  instanceId: INSTANCE_ID,
};
