import { ipcMain, MessageBoxOptions } from 'electron';
import { log, refreshMenu, createArticleView, createVideoView, watchVideo,
    closeTask, watchArticle, toggleTaskWindow, createFastVideoView, setAppAudioMuted,
    closeWinPlash, setSplashComplete, createAnswerBrowser, relaunch, showMessageBox,
    getInstanceInfo
} from './ipc-main-service';
import { setArticleChannels, setVideoChannels, getArticleChannels, getVideoChannels } from './store';
import axios from 'axios';
import { win } from './browser-window';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { 
  getPushPushToken, 
  getPushPushEnabled, 
  getPushPushEndpoint,
  getAutoPushTime,
  getDailyPushEnabled,
  setPushPushToken, 
  setPushPushEnabled, 
  setPushPushEndpoint,
  setAutoPushTime,
  setDailyPushEnabled
} from './store';

// 注册接受渲染进程事件
ipcMain.on('log', (event: Event, message?: any, ...optionalParams: any[]) => log(event, message, ...optionalParams));

ipcMain.on('set-app-audio-muted', (event, isMuted: boolean ) => setAppAudioMuted(isMuted));

ipcMain.on('close-win-splash', closeWinPlash);

ipcMain.on('set-splash-complete', setSplashComplete);

ipcMain.on('refresh-menu', (event, rate) => { refreshMenu(event, rate )});

ipcMain.on('create-article-view', (event, options) => createArticleView(event, options));

ipcMain.on('create-video-view', (event, options) => createVideoView(event, options));

ipcMain.on('create-fast-video-view', (event, options) => createFastVideoView(event, options));

ipcMain.on('watch-article', watchArticle);

ipcMain.on('watch-video', watchVideo);

ipcMain.on('toggle-task-window', (event, isShow: boolean) => toggleTaskWindow(isShow));

ipcMain.on('close-task', closeTask);

ipcMain.on('set-article-channels', (event, channels: []) => setArticleChannels(channels));

ipcMain.on('set-video-channels', (event, channels: []) => setVideoChannels(channels));

ipcMain.on('answer-the-question', (event, questionType: string) => createAnswerBrowser(questionType));

ipcMain.handle('get-article-channels', getArticleChannels);

ipcMain.handle('get-video-channels', getVideoChannels);

ipcMain.on('relaunch', (event) => {
	closeTask();
	relaunch();
});

ipcMain.handle('show-dialog-message', (event, options: MessageBoxOptions) => {
	return showMessageBox(options);
})

// 新增：处理二维码截图请求
ipcMain.handle('capture-qrcode', async (event) => {
    try {
        // 截取当前窗口
        const image = await win.webContents.capturePage();
        // 转换为base64
        const base64 = image.toPNG().toString('base64');
        
        // 保存到临时文件
        const tempDir = os.tmpdir();
        const timestamp = new Date().getTime();
        const imagePath = path.join(tempDir, `qrcode-${timestamp}.png`);
        
        fs.writeFileSync(imagePath, image.toPNG());
        
        return {
            success: true,
            path: imagePath,
            base64: base64
        };
    } catch (error) {
        console.error('截图二维码失败:', error);
        return {
            success: false,
            error: error.message || '截图失败'
        };
    }
});

// 新增：删除临时二维码图片文件
ipcMain.handle('delete-temp-qrcode', async (event, filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            // console.log('已删除临时二维码图片:', filePath);
            return { success: true };
        } else {
            console.log('临时二维码图片不存在:', filePath);
            return { success: true, message: '文件不存在' };
        }
    } catch (error) {
        console.error('删除临时二维码图片失败:', error);
        return { 
            success: false, 
            error: error.message || '删除失败' 
        };
    }
});

// 新增：处理刷新页面请求
ipcMain.handle('refresh-page', async (event) => {
    try {
        // 获取当前URL
        const currentUrl = win.webContents.getURL();
        console.log('刷新页面:', currentUrl);
        
        // 刷新页面
        win.webContents.reload();
        
        return {
            success: true,
            message: '页面刷新成功'
        };
    } catch (error) {
        console.error('刷新页面失败:', error);
        return {
            success: false,
            error: error.message || '刷新页面失败'
        };
    }
});

// 新增：处理网络请求
ipcMain.handle('network-request', async (event, options) => {
    try {
        const { url, method, headers, body, timeout } = options;
        
        const response = await axios({
            url,
            method,
            headers,
            data: body,
            timeout: timeout || 15000,
        });
        
        return response.data;
    } catch (error) {
        console.error('网络请求失败:', error);
        return {
            code: error.response?.status || 500,
            error: error.message || '网络请求失败'
        };
    }
});

// 添加获取实例信息的处理程序
ipcMain.handle('get-instance-info', () => {
    return getInstanceInfo();
});

// 添加获取PushPush配置的处理程序
ipcMain.handle('get-pushpush-config', () => {
    return {
        token: getPushPushToken(),
        enabled: getPushPushEnabled(),
        endpoint: getPushPushEndpoint(),
        autoPushTime: getAutoPushTime(),
        dailyPushEnabled: getDailyPushEnabled()
    };
});

// 添加保存PushPush配置的处理程序
ipcMain.handle('save-pushpush-config', (event, config) => {
    const { token, enabled, endpoint, autoPushTime, dailyPushEnabled } = config;
    
    if (token !== undefined) setPushPushToken(token);
    if (enabled !== undefined) setPushPushEnabled(enabled);
    if (endpoint !== undefined) setPushPushEndpoint(endpoint);
    if (autoPushTime !== undefined) setAutoPushTime(autoPushTime);
    if (dailyPushEnabled !== undefined) setDailyPushEnabled(dailyPushEnabled);
    
    return { success: true, message: '配置已保存' };
});

// 添加处理测试推送的处理程序
ipcMain.handle('send-test-push', async (event, testMessage) => {
    try {
        const { token, title, content, template, endpoint } = testMessage;
        
        if (!token) {
            return { success: false, message: '请提供有效的PushPlus token' };
        }
        
        // 定义可能的API端点
        const apiEndpoints = endpoint 
            ? [endpoint]
            : [
                'https://www.pushplus.plus/send',
                'https://pushplus.plus/send',
                'https://pushplus.hxtrip.com/send'
            ];
        
        let lastError = null;
        
        // 依次尝试各个端点
        for (const currentEndpoint of apiEndpoints) {
            try {
                console.log(`尝试使用端点 ${currentEndpoint} 发送测试推送...`);
                
                // 发送HTTP请求
                const response = await axios({
                    url: currentEndpoint,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    },
                    data: {
                        token,
                        title,
                        content,
                        template
                    },
                    timeout: 15000 // 15秒超时
                });
                
                if (response.data && response.data.code === 200) {
                    // 保存成功的端点
                    const { setPushPushEndpoint } = require('./store');
                    setPushPushEndpoint(currentEndpoint);
                    
                    return { success: true, message: '推送测试成功！' };
                } else {
                    console.log(`端点 ${currentEndpoint} 返回错误:`, response.data);
                    lastError = response.data;
                    // 继续尝试下一个端点
                }
            } catch (error) {
                console.error(`端点 ${currentEndpoint} 推送测试出错:`, error);
                lastError = error;
                // 继续尝试下一个端点
            }
        }
        
        // 所有端点都失败
        const errorDetail = lastError ? `最后错误: ${lastError.code || lastError.message || JSON.stringify(lastError)}` : '';
        return { 
            success: false, 
            message: `所有推送服务端点均连接失败，请检查网络连接或稍后再试。\n${errorDetail}\n如果问题持续存在，可能是PushPlus服务出现故障。\n请尝试手动设置端点或联系管理员。` 
        };
    } catch (error) {
        console.error('处理测试推送请求失败:', error);
        return { success: false, message: `处理请求失败: ${error.message || '未知错误'}` };
    }
});

// 添加处理推送通知的处理程序
ipcMain.handle('send-push-notification', async (event, pushMessage) => {
    try {
        const { token, title, content, template, endpoint } = pushMessage;
        
        if (!token) {
            return { success: false, message: '未提供PushPlus token' };
        }
        
        // 获取配置的端点或使用默认端点
        const { getPushPushEndpoint, setPushPushEndpoint } = require('./store');
        const configuredEndpoint = endpoint || getPushPushEndpoint();
        
        // 定义可能的API端点
        const apiEndpoints = [
            configuredEndpoint,
            'https://www.pushplus.plus/send',
            'https://pushplus.plus/send',
            'https://pushplus.hxtrip.com/send'
        ].filter((ep, index, self) => ep && self.indexOf(ep) === index); // 去重
        
        // 最大重试次数和重试延迟
        const maxRetries = 3;
        const retryDelay = 1000; // 1秒
        
        let lastError = null;
        
        // 依次尝试各个端点
        for (const currentEndpoint of apiEndpoints) {
            // 对每个端点进行多次重试
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    console.log(`尝试 ${attempt + 1}/${maxRetries}: 使用端点 ${currentEndpoint} 发送推送...`);
                    
                    // 发送HTTP请求
                    const response = await axios({
                        url: currentEndpoint,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        },
                        data: {
                            token,
                            title,
                            content,
                            template
                        },
                        timeout: 15000 // 15秒超时
                    });
                    
                    if (response.data && response.data.code === 200) {
                        // 保存成功的端点
                        setPushPushEndpoint(currentEndpoint);
                        
                        return { success: true, message: '推送成功' };
                    } else {
                        console.log(`端点 ${currentEndpoint} 返回错误:`, response.data);
                        lastError = response.data;
                        
                        // 如果还有重试次数，则等待后重试
                        if (attempt < maxRetries - 1) {
                            await new Promise(resolve => setTimeout(resolve, retryDelay));
                            continue;
                        }
                    }
                } catch (error) {
                    console.error(`端点 ${currentEndpoint} 推送出错:`, error);
                    lastError = error;
                    
                    // 如果还有重试次数，则等待后重试
                    if (attempt < maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue;
                    }
                }
            }
            
            // 当前端点的所有重试都失败，尝试下一个端点
        }
        
        // 所有端点和重试都失败
        const errorDetail = lastError ? `最后错误: ${lastError.code || lastError.message || JSON.stringify(lastError)}` : '';
        return { 
            success: false, 
            message: `所有推送服务端点均连接失败，请检查网络连接或稍后再试。${errorDetail}` 
        };
    } catch (error) {
        console.error('处理推送通知请求失败:', error);
        return { success: false, message: `处理请求失败: ${error.message || '未知错误'}` };
    }
});
