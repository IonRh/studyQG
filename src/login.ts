import { ipcRenderer } from 'electron';
import { delay } from './utils';
import { config } from './config';
import { userInfoUrl, examIndexUrl } from './urls';
import { ElementObserver } from './elementObserver';

// 声明全局window类型
declare global {
	interface Window {
		updatePushStatus: (message: string, type?: 'info' | 'success' | 'error') => void;
		navigation?: {
			addEventListener: (type: string, listener: (event: any) => void) => void;
		};
	}
}

// 定义二维码数据接口
interface QRCodeData {
	content: string | null;
	base64: string;
}

// 增强console.log，使其同时发送到主进程
const enhancedLog = (message: any, ...optionalParams: any[]) => {
	// 避免直接输出到控制台，只通过ipcRenderer.send发送到主进程
	// 这样可以避免重复日志，因为主进程的log函数会处理去重和格式化
	try {
		ipcRenderer.send('log', message, ...optionalParams);
	} catch (error) {
		// 如果发送失败，才使用控制台输出
		console.error('发送日志到主进程失败:', error);
		console.log(message, ...optionalParams);
	}
};

// 导入store中的方法
import {
	getPushPushToken,
	setPushPushToken,
	getPushPushEnabled,
	setPushPushEnabled,
	getPushPushEndpoint,
	setPushPushEndpoint,
	getAutoPushTime,
	setAutoPushTime,
	getDailyPushEnabled,
	setDailyPushEnabled
} from './store';

// 添加getter方法，方便其他模块直接使用
export const getPushpushToken = () => {
	const token = getPushPushToken();
	console.log('获取PushPush Token:', token);
	// enhancedLog('获取PushPush Token 值:', token);
	return token;
};

export const isPushpushEnabled = () => {
	const enabled = getPushPushEnabled();
	console.log('获取PushPush Enabled:', enabled);
	// enhancedLog('获取PushPush Enabled 值:', enabled);
	return enabled;
};

export const getPushpushEndpoint = () => getPushPushEndpoint();
export const getAutoPushTimeValue = () => getAutoPushTime();
export const isDailyPushEnabled = () => getDailyPushEnabled();

// 使用ipcRenderer发送网络请求
const sendHttpRequest = (url: string, options: any, data: any): Promise<any> => {
	return new Promise((resolve, reject) => {
		try {
			// 使用ipcRenderer发送网络请求给主进程处理
			ipcRenderer.invoke('network-request', {
				url,
				method: options.method || 'POST',
				headers: {
					'Content-Type': 'application/json',
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
					...options.headers
				},
				body: data,
				timeout: 15000 // 提高超时到15秒
			}).then(result => {
				resolve(result);
			}).catch(error => {
				reject(error);
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const getUserInfo = async () => {
	const res = await fetch(userInfoUrl, {
		credentials: 'include',
		referrer: examIndexUrl,
	});
	const rs = await res.json();
	if (rs.code !== 200) {
		throw new Error(rs.error);
	}
	return rs.data;
}

// 从IPC获取PushPush配置
export const getPushpushConfig = async () => {
	try {
		// enhancedLog('正在从主进程获取PushPush配置...');
		
		// 从主进程获取配置
		const config = await ipcRenderer.invoke('get-pushpush-config');
		
		if (config) {
			// enhancedLog('从主进程获取到PushPush配置:', config);
			
			// 更新store中的变量
			if (config.token !== undefined) {
				setPushPushToken(config.token);
				// enhancedLog('设置Token:', config.token);
			}
			if (config.enabled !== undefined) {
				setPushPushEnabled(config.enabled);
				// enhancedLog('设置Enabled:', config.enabled);
			}
			if (config.endpoint !== undefined) {
				setPushPushEndpoint(config.endpoint);
				// enhancedLog('设置Endpoint:', config.endpoint);
			}
			if (config.autoPushTime !== undefined) {
				setAutoPushTime(config.autoPushTime);
				// enhancedLog('设置AutoPushTime:', config.autoPushTime);
			}
			if (config.dailyPushEnabled !== undefined) {
				setDailyPushEnabled(config.dailyPushEnabled);
				// enhancedLog('设置DailyPushEnabled:', config.dailyPushEnabled);
			}
			
			return config;
		} else {
			enhancedLog('从主进程获取PushPush配置失败: 返回null');
		}
		
		return null;
	} catch (error) {
		console.error('获取PushPush配置失败:', error);
		enhancedLog('获取PushPush配置失败:', error);
		return null;
	}
};

// 显示PushPush配置弹窗
export const showPushpushConfig = async () => {
	// 先获取最新配置
	await getPushpushConfig();
	
	// 如果已经存在配置窗口，则不创建新窗口
	if (document.querySelector('#pushplus-config-modal')) {
		return;
	}
	
	// 获取当前配置
	const currentToken = getPushPushToken();
	const currentEnabled = getPushPushEnabled();
	const currentEndpoint = getPushPushEndpoint();
	const currentAutoPushTime = getAutoPushTime();
	const currentDailyPushEnabled = getDailyPushEnabled();
	
	// 创建弹窗容器
	const $modal = document.createElement('div');
	$modal.id = 'pushplus-config-modal';
	$modal.style.position = 'fixed';
	$modal.style.top = '0';
	$modal.style.left = '0';
	$modal.style.width = '100%';
	$modal.style.height = '100%';
	$modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
	$modal.style.zIndex = '9999';
	$modal.style.display = 'flex';
	$modal.style.justifyContent = 'center';
	$modal.style.alignItems = 'center';
	
	// 创建弹窗内容
	const $content = document.createElement('div');
	$content.style.backgroundColor = '#fff';
	$content.style.padding = '20px';
	$content.style.borderRadius = '10px';
	$content.style.width = '400px';
	$content.style.maxWidth = '90%';
	
	// 标题
	const $title = document.createElement('h2');
	$title.innerHTML = 'PushPlus推送配置';
	$title.style.marginTop = '0';
	$title.style.marginBottom = '20px';
	$title.style.textAlign = 'center';
	$content.appendChild($title);
	
	// Token输入框
	const $tokenLabel = document.createElement('div');
	$tokenLabel.innerHTML = 'PushPlus Token:';
	$tokenLabel.style.marginBottom = '5px';
	$content.appendChild($tokenLabel);
	
	const $tokenInput = document.createElement('input');
	$tokenInput.type = 'text';
	$tokenInput.value = currentToken || '';
	$tokenInput.style.width = '100%';
	$tokenInput.style.padding = '8px';
	$tokenInput.style.boxSizing = 'border-box';
	$tokenInput.style.marginBottom = '15px';
	$content.appendChild($tokenInput);
	
	// 添加说明文字
	const $hintText = document.createElement('div');
	$hintText.innerHTML = '请到 <a href="https://www.pushplus.plus/" target="_blank" style="color: #2196F3;">PushPlus官网</a> 获取推送token';
	$hintText.style.fontSize = '12px';
	$hintText.style.color = '#666';
	$hintText.style.marginBottom = '15px';
	$content.appendChild($hintText);
	
	// 自定义端点输入框（高级选项）
	const $advancedToggle = document.createElement('a');
	$advancedToggle.innerHTML = '显示高级选项';
	$advancedToggle.style.color = '#666';
	$advancedToggle.style.fontSize = '12px';
	$advancedToggle.style.cursor = 'pointer';
	$advancedToggle.style.display = 'block';
	$advancedToggle.style.marginBottom = '10px';
	$content.appendChild($advancedToggle);
	
	const $advancedOptions = document.createElement('div');
	$advancedOptions.style.display = 'none';
	$advancedOptions.style.marginBottom = '15px';
	$advancedOptions.style.padding = '10px';
	$advancedOptions.style.backgroundColor = '#f9f9f9';
	$advancedOptions.style.borderRadius = '4px';
	
	const $endpointLabel = document.createElement('div');
	$endpointLabel.innerHTML = '自定义API端点:';
	$endpointLabel.style.marginBottom = '5px';
	$advancedOptions.appendChild($endpointLabel);
	
	const $endpointInput = document.createElement('input');
	$endpointInput.type = 'text';
	$endpointInput.value = currentEndpoint;
	$endpointInput.style.width = '100%';
	$endpointInput.style.padding = '8px';
	$endpointInput.style.boxSizing = 'border-box';
	$advancedOptions.appendChild($endpointInput);
	
	// 添加时间配置选项
	const $timeSectionTitle = document.createElement('div');
	$timeSectionTitle.innerHTML = '自动推送设置:';
	$timeSectionTitle.style.marginTop = '15px';
	$timeSectionTitle.style.marginBottom = '5px';
	$timeSectionTitle.style.fontWeight = 'bold';
	$advancedOptions.appendChild($timeSectionTitle);
	
	// 添加每日推送开关
	const $dailyPushWrapper = document.createElement('div');
	$dailyPushWrapper.style.marginBottom = '10px';
	$dailyPushWrapper.style.display = 'flex';
	$dailyPushWrapper.style.alignItems = 'center';
	
	const $dailyPushCheckbox = document.createElement('input');
	$dailyPushCheckbox.type = 'checkbox';
	$dailyPushCheckbox.id = 'daily-push-enable';
	$dailyPushCheckbox.checked = currentDailyPushEnabled;
	$dailyPushWrapper.appendChild($dailyPushCheckbox);
	
	const $dailyPushLabel = document.createElement('label');
	$dailyPushLabel.htmlFor = 'daily-push-enable';
	$dailyPushLabel.innerHTML = ' 启用每日定时推送';
	$dailyPushLabel.style.marginLeft = '5px';
	$dailyPushWrapper.appendChild($dailyPushLabel);
	
	$advancedOptions.appendChild($dailyPushWrapper);
	
	// 添加时间选择器
	const $timeLabel = document.createElement('div');
	$timeLabel.innerHTML = '每日推送时间:';
	$timeLabel.style.marginBottom = '5px';
	$advancedOptions.appendChild($timeLabel);
	
	const $timeInput = document.createElement('input');
	$timeInput.type = 'time';
	$timeInput.value = currentAutoPushTime;
	$timeInput.style.width = '100%';
	$timeInput.style.padding = '8px';
	$timeInput.style.boxSizing = 'border-box';
	$timeInput.style.marginBottom = '5px';
	$advancedOptions.appendChild($timeInput);
	
	const $timeHint = document.createElement('div');
	$timeHint.innerHTML = '设置每天自动推送登录二维码的时间';
	$timeHint.style.fontSize = '12px';
	$timeHint.style.color = '#666';
	$timeHint.style.marginBottom = '10px';
	$advancedOptions.appendChild($timeHint);
	
	$content.appendChild($advancedOptions);
	
	$advancedToggle.addEventListener('click', () => {
		if ($advancedOptions.style.display === 'none') {
			$advancedOptions.style.display = 'block';
			$advancedToggle.innerHTML = '隐藏高级选项';
		} else {
			$advancedOptions.style.display = 'none';
			$advancedToggle.innerHTML = '显示高级选项';
		}
	});
	
	// 启用推送复选框
	const $enableWrapper = document.createElement('div');
	$enableWrapper.style.marginBottom = '20px';
	
	const $enableCheckbox = document.createElement('input');
	$enableCheckbox.type = 'checkbox';
	$enableCheckbox.id = 'push-enable';
	$enableCheckbox.checked = currentEnabled;
	$enableWrapper.appendChild($enableCheckbox);
	
	const $enableLabel = document.createElement('label');
	$enableLabel.htmlFor = 'push-enable';
	$enableLabel.innerHTML = ' 启用推送';
	$enableLabel.style.marginLeft = '5px';
	$enableWrapper.appendChild($enableLabel);
	
	$content.appendChild($enableWrapper);
	
	// 测试按钮
	const $testButton = document.createElement('button');
	$testButton.innerHTML = '测试推送';
	$testButton.style.padding = '8px 15px';
	$testButton.style.backgroundColor = '#4CAF50';
	$testButton.style.color = 'white';
	$testButton.style.border = 'none';
	$testButton.style.borderRadius = '4px';
	$testButton.style.cursor = 'pointer';
	$testButton.style.marginRight = '10px';
	
	// 状态消息
	const $message = document.createElement('div');
	$message.style.marginTop = '15px';
	$message.style.padding = '10px';
	$message.style.backgroundColor = '#f1f1f1';
	$message.style.borderRadius = '4px';
	$message.style.display = 'none';
	$content.appendChild($message);
	
	// 按钮容器
	const $buttonContainer = document.createElement('div');
	$buttonContainer.style.display = 'flex';
	$buttonContainer.style.justifyContent = 'space-between';
	$buttonContainer.style.marginTop = '20px';
	
	$buttonContainer.appendChild($testButton);
	
	const $saveButton = document.createElement('button');
	$saveButton.innerHTML = '保存设置';
	$saveButton.style.padding = '8px 15px';
	$saveButton.style.backgroundColor = '#2196F3';
	$saveButton.style.color = 'white';
	$saveButton.style.border = 'none';
	$saveButton.style.borderRadius = '4px';
	$saveButton.style.cursor = 'pointer';
	$buttonContainer.appendChild($saveButton);
	
	const $cancelButton = document.createElement('button');
	$cancelButton.innerHTML = '取消';
	$cancelButton.style.padding = '8px 15px';
	$cancelButton.style.backgroundColor = '#f1f1f1';
	$cancelButton.style.border = 'none';
	$cancelButton.style.borderRadius = '4px';
	$cancelButton.style.cursor = 'pointer';
	$buttonContainer.appendChild($cancelButton);
	
	$content.appendChild($buttonContainer);
	
	$modal.appendChild($content);
	document.body.appendChild($modal);
	
	// 显示状态消息
	const showMessage = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
		$message.innerHTML = text;
		$message.style.display = 'block';
		
		if (type === 'success') {
			$message.style.backgroundColor = '#e8f5e9';
			$message.style.color = '#2e7d32';
		} else if (type === 'error') {
			$message.style.backgroundColor = '#ffebee';
			$message.style.color = '#c62828';
		} else {
			$message.style.backgroundColor = '#e3f2fd';
			$message.style.color = '#1565c0';
		}
	};
	
	// 测试按钮点击事件
	$testButton.addEventListener('click', async () => {
		const token = $tokenInput.value.trim();
		if (!token) {
			showMessage('请先输入PushPlus token', 'error');
			return;
		}
		
		// 禁用按钮防止重复点击
		$testButton.disabled = true;
		$testButton.innerHTML = '测试中...';
		
		// 显示测试中消息
		showMessage('正在发送测试推送...', 'info');
		
		// 执行测试
		const result = await testPushpush(token, $endpointInput.value);
		
		// 恢复按钮状态
		$testButton.disabled = false;
		$testButton.innerHTML = '测试推送';
		
		// 显示测试结果
		if (result.success) {
			showMessage(result.message, 'success');
		} else {
			showMessage(result.message, 'error');
		}
	});
	
	// 保存按钮点击事件
	$saveButton.addEventListener('click', async () => {
		const token = $tokenInput.value.trim();
		const enabled = $enableCheckbox.checked;
		const endpoint = $endpointInput.value.trim();
		const autoPushTimeValue = $timeInput.value;
		const dailyPushValue = $dailyPushCheckbox.checked;
		
		// 禁用按钮防止重复点击
		$saveButton.disabled = true;
		$saveButton.innerHTML = '保存中...';
		
		// 执行保存
		const result = await savePushpushSettings(token, enabled, endpoint, autoPushTimeValue, dailyPushValue);
		
		// 恢复按钮状态
		$saveButton.disabled = false;
		$saveButton.innerHTML = '保存设置';
		
		// 显示保存结果
		if (result.success) {
			showMessage('设置已保存', 'success');
			// 3秒后关闭弹窗
			setTimeout(() => {
				document.body.removeChild($modal);
			}, 3000);
		} else {
			showMessage(result.message, 'error');
		}
	});
	
	// 取消按钮点击事件
	$cancelButton.addEventListener('click', () => {
		document.body.removeChild($modal);
	});
};

export const onLogin = async () => {
	const elementObserver = new ElementObserver('.ddlogintext', callback);

	async function callback() {
		// 标记登录页面已激活
		isLoginPageActive = true;
		
		// 设置页面可见性监听
		setupPageVisibilityListener();
		
		const $layoutBody = document.querySelector('.layout-body') as HTMLElement;
		// 隐藏页面无用的元素
		document.body.style.overflow = 'hidden';
		document
			.querySelectorAll('.layout-header, .redflagbox, .layout-footer, .oath')
			.forEach((element: HTMLElement) => {
				element.style.display = 'none';
			});

		$layoutBody.classList.remove('login-page-bg');

		document
			.querySelectorAll('.login-page-bg')
			.forEach((element: HTMLElement) => {
				console.log(element)
				element.style.backgroundImage = '';
			});

		// 调整页面样式
		[document.documentElement, document.body].forEach((element: HTMLElement) => {
			element.style.minWidth = 'unset';
			element.style.display = 'flex';
			element.style.justifyContent = 'center';
			element.style.alignItems = 'center';
			element.style.background = '#333333';
			element.style.backgroundRepeat = 'no-repeat';
			element.style.backgroundSize = 'cover';
		});
		const text = `${config.tipsPrefix}打开APP扫它👆`;
		const $loginText = document.querySelector('.ddlogintext');
		console.log($loginText, 'loginText')
		if ($loginText) {
			$loginText.innerHTML = text;
			($loginText as HTMLElement).style.color = '#fff';
			
			// 添加推送状态显示区域
			const $pushStatus = document.createElement('div');
			$pushStatus.id = 'push-status';
			$pushStatus.style.color = '#fff';
			$pushStatus.style.marginTop = '10px';
			$pushStatus.style.textAlign = 'center';
			$pushStatus.style.fontSize = '14px';
			$pushStatus.style.padding = '5px';
			$pushStatus.style.borderRadius = '4px';
			$pushStatus.style.display = 'none';
			($loginText as HTMLElement).parentNode.appendChild($pushStatus);
			
			// 设置推送状态的辅助函数
			window.updatePushStatus = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
				$pushStatus.style.display = 'block';
				$pushStatus.textContent = message;
				
				switch (type) {
					case 'success':
						$pushStatus.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
						$pushStatus.style.border = '1px solid #4CAF50';
						break;
					case 'error':
						$pushStatus.style.backgroundColor = 'rgba(244, 67, 54, 0.2)';
						$pushStatus.style.border = '1px solid #F44336';
						break;
					default:
						$pushStatus.style.backgroundColor = 'rgba(33, 150, 243, 0.2)';
						$pushStatus.style.border = '1px solid #2196F3';
				}
				
				console.log('推送状态更新:', message);
			};
			
			// 初始化推送计数显示
			updatePushCountDisplay();
			
			// 添加PushPlus设置按钮
			const $pushConfig = document.createElement('a');
			$pushConfig.innerHTML = `【PushPlus推送设置】`;
			$pushConfig.style.color = '#fff';
			$pushConfig.style.cursor = 'pointer';
			$pushConfig.style.display = 'block';
			$pushConfig.style.textAlign = 'center';
			$pushConfig.style.marginTop = '20px';
			$pushConfig.style.fontSize = '14px';
			$pushConfig.style.textDecoration = 'none';
			$pushConfig.style.border = '1px solid #4CAF50';
			$pushConfig.style.borderRadius = '4px';
			$pushConfig.style.padding = '8px 15px';
			$pushConfig.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
			
			$pushConfig.addEventListener('click', () => {
				showPushpushConfig(); // 使用共享的配置函数
			});
			
			($loginText as HTMLElement).parentNode.appendChild($pushConfig);
			
			// 创建截图并推送按钮
			const $captureButton = document.createElement('a');
			$captureButton.innerHTML = `【截图并推送二维码】`;
			$captureButton.style.color = '#fff';
			$captureButton.style.cursor = 'pointer';
			$captureButton.style.display = 'block';
			$captureButton.style.textAlign = 'center';
			$captureButton.style.marginTop = '10px';
			$captureButton.style.fontSize = '14px';
			$captureButton.style.textDecoration = 'none';
			$captureButton.style.border = '1px solid #2196F3';
			$captureButton.style.borderRadius = '4px';
			$captureButton.style.padding = '8px 15px';
			$captureButton.style.backgroundColor = 'rgba(33, 150, 243, 0.2)';
			
			$captureButton.addEventListener('click', () => {
				captureAndPushQrCode();
			});
			
			($loginText as HTMLElement).parentNode.appendChild($captureButton);
			
			// 查找二维码元素并推送
			setTimeout(async () => {
				// 清理可能残留的短期推送序列状态（页面刷新或重新进入）
				const storedInSequence = localStorage.getItem('is-in-short-term-sequence') === 'true';
				const storedPushCount = parseInt(localStorage.getItem('short-term-push-count') || '0');
				
				// 检查是否是页面刷新后的推送（在短期推送序列中）
				const isRefreshedPush = localStorage.getItem('waiting-for-refresh-push') === 'true';
				if (isRefreshedPush && storedInSequence) {
					// enhancedLog('检测到页面刷新后的推送请求，恢复短期推送序列');
					// 清除等待标记
					localStorage.removeItem('waiting-for-refresh-push');
					
					// 恢复短期推送序列状态
					isInShortTermSequence = true;
					shortTermPushCount = storedPushCount;
					updatePushCountDisplay();
					
					if (isPushpushEnabled() && getPushpushToken()) {
						// enhancedLog('执行刷新后的推送流程');
						if (window.updatePushStatus) {
							let statusMessage = '页面已刷新，正在推送新二维码...';
							if (shortTermPushCount > 0) {
								statusMessage += `（第 ${shortTermPushCount}/${MAX_SHORT_TERM_PUSH} 次推送）`;
							}
							window.updatePushStatus(statusMessage);
						}
						
						// 执行推送
						await processAndSendQrCode();
						
						// 记录推送时间
						localStorage.setItem('last-qr-notification-time', new Date().getTime().toString());
						localStorage.setItem('last-qr-notification-date', new Date().toDateString());
						
						// 如果在短期推送序列中，继续设置下一次推送
						if (isInShortTermSequence && shortTermPushCount < MAX_SHORT_TERM_PUSH && !isLoggedIn() && isLoginPageActive) {
							const nextPushTime = new Date(Date.now() + SHORT_TERM_PUSH_INTERVAL);
							enhancedLog(`继续短期推送序列，设置下一次推送时间: ${nextPushTime.toLocaleString()}`);
							
							if (window.updatePushStatus) {
								window.updatePushStatus(`下一次推送将在 ${nextPushTime.toLocaleString()} 执行（第 ${shortTermPushCount + 1}/${MAX_SHORT_TERM_PUSH} 次）`, 'info');
							}
							
							shortTermPushTimer = setTimeout(() => {
								executeShortTermPush();
							}, SHORT_TERM_PUSH_INTERVAL);
						}
					}
					return; // 页面刷新后的推送处理完毕，直接返回
				} else {
					// 如果不是刷新推送，清理任何残留的短期推送状态
					if (storedInSequence) {
						enhancedLog('清理残留的短期推送序列状态');
						localStorage.removeItem('is-in-short-term-sequence');
						localStorage.removeItem('short-term-push-count');
					}
					// 清除刷新标记（如果存在）
					localStorage.removeItem('waiting-for-refresh-push');
				}
				
				// 检查是否应该推送（首次启动或已到推送时间）
				const shouldPush = checkShouldPush();
				if (shouldPush && isPushpushEnabled() && getPushpushToken()) {
					// 首次启动或到达推送时间，开始短期推送流程
					// enhancedLog('开始推送流程');
					
					if (isFirstLaunch()) {
						// 首次启动，直接推送
						await processAndSendQrCode();
						localStorage.setItem('last-qr-notification-time', new Date().getTime().toString());
						localStorage.setItem('last-qr-notification-date', new Date().toDateString());
					} else {
						// 到达推送时间，开始短期推送序列
						startShortTermPushSequence();
					}
				} else if (isDailyPushEnabled() && getPushpushToken() && !isInShortTermSequence && isLoginPageActive) {
					// 设置每日推送定时器（只有在非短期推送序列中且在登录页面时才设置）
					enhancedLog('设置每日推送定时器');
					scheduleNextPush();
				}
			}, 3000); // 等待3秒确保二维码已加载
		}
		// 关闭闪屏页
		ipcRenderer.send('close-win-splash');
		elementObserver.disconnectObserver();
	}
};

export const isLoggedIn = () => {
	return document.cookie.includes('token=');
};

// 测试推送函数
export const testPushpush = async (token: string, customEndpoint: string = '') => {
	if (!token) return { success: false, message: '请先输入PushPlus token' };
	
	try {
		// 创建测试推送的请求数据
		const testMessage = {
			token: token,
			title: '学习强国推送测试',
			content: '这是一条测试推送消息',
			template: 'html',
			endpoint: customEndpoint
		};
		
		// // 在UI上显示状态
		// console.log(`正在使用端点 ${customEndpoint || '默认端点'} 发送测试推送...`);
		// enhancedLog(`正在使用端点 ${customEndpoint || '默认端点'} 发送测试推送...`);
		
		// 使用IPC发送测试推送请求
		const result = await ipcRenderer.invoke('send-test-push', testMessage);
		
		// 处理结果
		if (result.success) {
			return { success: true, message: '推送测试成功！' };
		} else {
			return { 
				success: false, 
				message: result.message || '推送测试失败，请检查网络连接或稍后再试。' 
			};
		}
	} catch (error) {
		console.error('测试推送出错:', error);
		enhancedLog('测试推送出错:', error);
		return { 
			success: false, 
			message: `推送测试失败: ${error.message || '未知错误'}\n请检查网络连接或稍后再试。` 
		};
	}
};

// 添加未扫码情况下的短期重复推送计数和设置
let shortTermPushCount = 0; // 短期内的推送次数计数
const MAX_SHORT_TERM_PUSH = 5; // 最大短期推送次数
const SHORT_TERM_PUSH_INTERVAL = 10 * 60 * 1000; // 10分钟的短期推送间隔
let shortTermPushTimer: NodeJS.Timeout | null = null; // 短期推送定时器
let dailyPushTimer: NodeJS.Timeout | null = null; // 每日推送定时器
let isInShortTermSequence = false; // 标记是否正在短期推送序列中
let isLoginPageActive = false; // 标记登录页面是否激活

// 创建或更新推送计数显示
const updatePushCountDisplay = () => {
	let $pushCountDisplay = document.getElementById('push-count-display');
	
	// 如果显示元素不存在，创建它
	if (!$pushCountDisplay) {
		$pushCountDisplay = document.createElement('div');
		$pushCountDisplay.id = 'push-count-display';
		$pushCountDisplay.style.color = '#fff';
		$pushCountDisplay.style.marginTop = '10px';
		$pushCountDisplay.style.textAlign = 'center';
		$pushCountDisplay.style.fontSize = '14px';
		$pushCountDisplay.style.padding = '5px';
		$pushCountDisplay.style.borderRadius = '4px';
		$pushCountDisplay.style.backgroundColor = 'rgba(255, 152, 0, 0.2)';
		$pushCountDisplay.style.border = '1px solid #FF9800';
		
		// 添加到页面中适当的位置
		const $loginText = document.querySelector('.ddlogintext');
		if ($loginText && $loginText.parentNode) {
			($loginText as HTMLElement).parentNode.appendChild($pushCountDisplay);
		} else {
			// 如果找不到.ddlogintext，尝试添加到body
			document.body.appendChild($pushCountDisplay);
		}
	}
	
	// 更新推送计数显示内容
	if (shortTermPushCount > 0 && shortTermPushCount < MAX_SHORT_TERM_PUSH) {
		$pushCountDisplay.style.display = 'block';
		$pushCountDisplay.innerHTML = `推送进度：第 ${shortTermPushCount}/${MAX_SHORT_TERM_PUSH} 次（每10分钟一次）`;
	} else if (shortTermPushCount === MAX_SHORT_TERM_PUSH) {
		// 如果计数为0，可以隐藏显示或显示初始状态
		$pushCountDisplay.style.display = 'none';
	} else {
		$pushCountDisplay.style.display = 'none';
	}
};

// 清除所有推送定时器
const clearAllPushTimers = () => {
	if (shortTermPushTimer) {
		clearTimeout(shortTermPushTimer);
		shortTermPushTimer = null;
		enhancedLog('已清除短期推送定时器');
	}
	if (dailyPushTimer) {
		clearTimeout(dailyPushTimer);
		dailyPushTimer = null;
		enhancedLog('已清除每日推送定时器');
	}
};

// 设置页面可见性监听
const setupPageVisibilityListener = () => {
	// 监听页面卸载事件
	window.addEventListener('beforeunload', () => {
		// 检查是否是主动刷新（如果是主动刷新，不清理短期推送序列状态）
		const isWaitingForRefresh = localStorage.getItem('waiting-for-refresh-push') === 'true';
		if (isWaitingForRefresh) {
			// enhancedLog('页面主动刷新，保留短期推送序列状态');
			// 保存当前短期推送状态，不执行清理
			if (isInShortTermSequence) {
				localStorage.setItem('is-in-short-term-sequence', 'true');
				localStorage.setItem('short-term-push-count', shortTermPushCount.toString());
			}
		} else {
			enhancedLog('页面即将卸载，清理定时器');
			onPageDeactivated();
		}
	});
	
	// 监听hash变化（如果是单页应用路由变化）
	window.addEventListener('hashchange', () => {
		// 检查是否仍在登录页面
		if (!window.location.href.includes('login')) {
			enhancedLog('离开登录页面');
			onPageDeactivated();
		} else {
			enhancedLog('仍在登录页面');
			// 确保页面状态为激活
			if (!isLoginPageActive) {
				onPageActivated();
			}
		}
	});
	
	// 监听URL变化（如果支持Navigation API）
	try {
		if (window.navigation && typeof window.navigation.addEventListener === 'function') {
			window.navigation.addEventListener('navigate', (event: any) => {
				if (event.destination && event.destination.url) {
					if (!event.destination.url.includes('login')) {
						enhancedLog('导航离开登录页面');
						onPageDeactivated();
					} else {
						enhancedLog('导航到登录页面');
						if (!isLoginPageActive) {
							onPageActivated();
						}
					}
				}
			});
		}
	} catch (error) {
		// Navigation API 不支持或出错，忽略
		enhancedLog('Navigation API 不支持或出错:', error);
	}
	
	// 监听popstate事件（浏览器前进后退）
	window.addEventListener('popstate', () => {
		// 检查是否仍在登录页面
		if (!window.location.href.includes('login')) {
			enhancedLog('通过浏览器导航离开登录页面');
			onPageDeactivated();
		} else {
			enhancedLog('通过浏览器导航到登录页面');
			if (!isLoginPageActive) {
				onPageActivated();
			}
		}
	});
	
	// 监听页面加载完成事件
	window.addEventListener('load', () => {
		enhancedLog('页面加载完成');
		// 如果当前在登录页面，确保页面状态为激活
		if (window.location.href.includes('login')) {
			if (!isLoginPageActive) {
				onPageActivated();
			}
		}
	});
};

// 页面激活时的处理
const onPageActivated = () => {
	enhancedLog('登录页面已激活，启动定时器系统');
	isLoginPageActive = true;
	
	// 检查是否有短期推送序列需要恢复
	const storedInSequence = localStorage.getItem('is-in-short-term-sequence') === 'true';
	const storedPushCount = parseInt(localStorage.getItem('short-term-push-count') || '0');
	
	if (storedInSequence && storedPushCount > 0) {
		// 恢复短期推送序列状态
		enhancedLog(`恢复短期推送序列状态，当前计数: ${storedPushCount}`);
		isInShortTermSequence = true;
		shortTermPushCount = storedPushCount;
		updatePushCountDisplay();
		
		// 不需要立即设置定时器，因为刷新推送逻辑会处理
		return;
	} else {
		// 重置短期推送相关状态
		isInShortTermSequence = false;
		shortTermPushCount = 0;
		localStorage.removeItem('is-in-short-term-sequence');
		localStorage.removeItem('short-term-push-count');
		
		// 更新推送计数显示
		updatePushCountDisplay();
		
		// 如果启用了每日推送，设置每日推送定时器
		if (isDailyPushEnabled() && getPushpushToken()) {
			enhancedLog('页面激活，设置每日推送定时器');
			scheduleDailyPush();
		}
	}
};

// 页面停用时的处理
const onPageDeactivated = () => {
	enhancedLog('登录页面已停用，清理所有定时器和短期推送序列');
	isLoginPageActive = false;
	
	// 清除所有定时器
	clearAllPushTimers();
	
	// 清理短期推送序列状态（只有在非刷新情况下才清理）
	const isWaitingForRefresh = localStorage.getItem('waiting-for-refresh-push') === 'true';
	if (!isWaitingForRefresh && isInShortTermSequence) {
		enhancedLog('离开登录页面（非刷新），清理短期推送序列状态');
		isInShortTermSequence = false;
		localStorage.removeItem('is-in-short-term-sequence');
		localStorage.removeItem('short-term-push-count');
		shortTermPushCount = 0;
		// 不需要更新显示，因为页面已经离开
	} else if (isWaitingForRefresh) {
		enhancedLog('页面刷新中，保留短期推送序列状态');
	}
};

// 设置每日推送定时器
const scheduleDailyPush = () => {
	// 如果页面不在登录页面，不设置定时器
	if (!isLoginPageActive) {
		enhancedLog('不在登录页面，跳过设置每日推送定时器');
		return;
	}
	
	// 清除现有的每日推送定时器
	if (dailyPushTimer) {
		clearTimeout(dailyPushTimer);
		dailyPushTimer = null;
	}

	if (!isDailyPushEnabled()) {
		enhancedLog('每日推送未启用，跳过设置定时器');
		return;
	}

	const now = new Date();
	const [hours, minutes] = getAutoPushTimeValue().split(':').map(Number);
	
	// 设置目标时间为今天的设定时间点
	let targetTime = new Date();
	targetTime.setHours(hours, minutes, 0, 0);
	
	// 如果当前时间已经过了今天的设定时间，则目标时间设为明天的设定时间
	if (now.getTime() > targetTime.getTime()) {
		targetTime.setDate(targetTime.getDate() + 1);
	}
	
	// 计算时间差（毫秒）
	const timeUntilTarget = targetTime.getTime() - now.getTime();
	
	enhancedLog(`设置每日推送定时器: ${targetTime.toLocaleString()}, ${Math.floor(timeUntilTarget / (1000 * 60 * 60))}小时${Math.floor((timeUntilTarget % (1000 * 60 * 60)) / (1000 * 60))}分钟后`);
	
	if (window.updatePushStatus) {
		window.updatePushStatus(`下一次推送将在 ${targetTime.toLocaleString()} 开始`, 'info');
	}
	
	// 设置每日推送定时器
	dailyPushTimer = setTimeout(() => {
		if (isLoginPageActive) { // 确保页面仍然激活
			enhancedLog('每日推送定时器触发，开始短期推送流程');
			startShortTermPushSequence();
		} else {
			enhancedLog('页面已停用，跳过每日推送');
		}
	}, timeUntilTarget);
};

// 修改调度下一次推送的函数
const scheduleNextPush = () => {
	// 如果不在登录页面，不设置定时器
	if (!isLoginPageActive) {
		enhancedLog('不在登录页面，跳过设置推送定时器');
		return;
	}
	
	// 检查是否已登录
	const isLoggedInNow = isLoggedIn();
	
	if (isLoggedInNow) {
		enhancedLog('检测到已登录，清除所有推送定时器');
		clearAllPushTimers();
		// 结束短期推送序列
		isInShortTermSequence = false;
		localStorage.removeItem('is-in-short-term-sequence');
		localStorage.removeItem('short-term-push-count');
		shortTermPushCount = 0;
		updatePushCountDisplay();
		if (window.updatePushStatus) {
			window.updatePushStatus('检测到已登录，已停止推送计划', 'success');
		}
		return;
	}
	
	// 如果启用了每日推送且当前不在短期推送序列中
	if (isDailyPushEnabled() && !isInShortTermSequence) {
		// enhancedLog('非短期推送序列状态，设置每日推送定时器');
		scheduleDailyPush();
	}
};

// 执行短期推送
const executeShortTermPush = async () => {
	// 如果不在登录页面，不执行推送
	if (!isLoginPageActive) {
		enhancedLog('不在登录页面，跳过短期推送');
		return;
	}
	
	// 检查是否已登录
	if (isLoggedIn()) {
		enhancedLog('检测到已登录，停止短期推送序列');
		// 结束短期推送序列
		isInShortTermSequence = false;
		localStorage.removeItem('is-in-short-term-sequence');
		localStorage.removeItem('short-term-push-count');
		shortTermPushCount = 0;
		updatePushCountDisplay();
		if (window.updatePushStatus) {
			window.updatePushStatus('检测到已登录，已停止推送计划', 'success');
		}
		return;
	}
	
	// 检查是否已达到最大推送次数
	if (shortTermPushCount >= MAX_SHORT_TERM_PUSH) {
		enhancedLog('已达到最大短期推送次数限制，回归每日推送模式');
		// 结束短期推送序列
		isInShortTermSequence = false;
		localStorage.removeItem('is-in-short-term-sequence');
		localStorage.removeItem('short-term-push-count');
		shortTermPushCount = 0;
		updatePushCountDisplay();
		if (window.updatePushStatus) {
			window.updatePushStatus('已完成短期推送计划，回归正常推送模式', 'info');
		}
		// 设置下一个每日推送定时器
		if (isDailyPushEnabled()) {
			enhancedLog('短期推送完成，重新设置每日推送定时器');
			clearAllPushTimers();
			scheduleDailyPush();
		}
		return;
	}
	
	// 增加推送计数
	shortTermPushCount++;
	// 同时保存到localStorage以防页面刷新丢失
	localStorage.setItem('short-term-push-count', shortTermPushCount.toString());
	updatePushCountDisplay();
	
	enhancedLog(`执行第 ${shortTermPushCount}/${MAX_SHORT_TERM_PUSH} 次短期推送`);
	
	if (window.updatePushStatus) {
		window.updatePushStatus(`正在执行第 ${shortTermPushCount}/${MAX_SHORT_TERM_PUSH} 次推送...`);
	}
	
	// 执行推送
	if (isPushpushEnabled() && getPushpushToken()) {
		// 刷新页面并推送二维码
		await refreshPageAndPushQrCode();
	}
	
	// 如果还没有达到最大次数且未登录，设置下一次推送
	if (shortTermPushCount < MAX_SHORT_TERM_PUSH && !isLoggedIn() && isLoginPageActive) {
		const nextPushTime = new Date(Date.now() + SHORT_TERM_PUSH_INTERVAL);
		enhancedLog(`设置下一次短期推送时间: ${nextPushTime.toLocaleString()}`);
		
		if (window.updatePushStatus) {
			window.updatePushStatus(`下一次推送将在 ${nextPushTime.toLocaleString()} 执行（第 ${shortTermPushCount + 1}/${MAX_SHORT_TERM_PUSH} 次）`, 'info');
		}
		
		shortTermPushTimer = setTimeout(() => {
			executeShortTermPush();
		}, SHORT_TERM_PUSH_INTERVAL);
	} 
};

// 修改savePushpushSettings函数，保存设置后不立即执行推送，只设置定时器
export const savePushpushSettings = async (token: string, enabled: boolean, endpoint?: string, autoPushTimeValue?: string, dailyPushValue?: boolean) => {
	try {
		// 通过IPC保存配置
		const result = await ipcRenderer.invoke('save-pushpush-config', {
			token,
			enabled,
			endpoint,
			autoPushTime: autoPushTimeValue,
			dailyPushEnabled: dailyPushValue
		});
		
		// 更新store中的变量
		setPushPushToken(token);
		setPushPushEnabled(enabled);
		
		if (endpoint !== undefined) {
			setPushPushEndpoint(endpoint);
		}
		
		if (autoPushTimeValue !== undefined) {
			setAutoPushTime(autoPushTimeValue);
		}
		
		if (dailyPushValue !== undefined) {
			setDailyPushEnabled(dailyPushValue);
		}
		
		// 清除现有定时器
		clearAllPushTimers();
		
		// 如果启用了推送，重置短期推送计数并设置定时器，但不立即推送
		if (enabled && token) {
			// enhancedLog('推送已启用，重置短期推送计数并设置定时器');
			// 结束当前短期推送序列
			isInShortTermSequence = false;
			localStorage.removeItem('is-in-short-term-sequence');
			localStorage.removeItem('short-term-push-count');
			shortTermPushCount = 0;
			updatePushCountDisplay();
			
			// 设置推送定时器
			if (dailyPushValue) {
				setTimeout(() => {
					scheduleNextPush();
					if (window.updatePushStatus) {
						window.updatePushStatus('推送设置已保存，将在设定的时间执行推送', 'success');
					}
				}, 1000);
			}
		} else {
			// 如果禁用了推送，清除显示和状态
			isInShortTermSequence = false;
			localStorage.removeItem('is-in-short-term-sequence');
			localStorage.removeItem('short-term-push-count');
			shortTermPushCount = 0;
			updatePushCountDisplay();
		}
		
		return { success: true, message: '设置已保存，将在设定的时间执行推送' };
	} catch (error) {
		console.error('保存PushPush设置失败:', error);
		return { success: false, message: '保存设置失败: ' + (error.message || '未知错误') };
	}
};

// 发送推送
export const sendPushpush = async (title: string, content: string) => {
	// 检查是否启用了推送
	const isEnabled = getPushPushEnabled();
	const token = getPushPushToken();
	
	if (!isEnabled || !token) return false;
	
	// 获取最新配置
	try {
		await getPushpushConfig();
	} catch (error) {
		console.error('获取最新配置失败:', error);
		// 继续使用当前配置
	}
	
	// 再次检查是否启用了推送
	if (!getPushPushEnabled() || !getPushPushToken()) return false;
	
	if (window.updatePushStatus) {
		window.updatePushStatus('正在发送推送通知...');
	}
	
	try {
		// 创建推送消息
		const pushMessage = {
			token: getPushPushToken(),
			title: title,
			content: content,
			template: 'html',
			endpoint: getPushPushEndpoint()
		};
		
		// 使用IPC发送推送
		const result = await ipcRenderer.invoke('send-push-notification', pushMessage);
		
		if (result.success) {
			console.log('推送成功！');
			if (window.updatePushStatus) {
				window.updatePushStatus('推送成功！二维码已发送到您的设备', 'success');
			}
			return true;
		} else {
			console.error('推送失败:', result.message);
			if (window.updatePushStatus) {
				window.updatePushStatus(`推送失败: ${result.message}`, 'error');
			}
			return false;
		}
	} catch (error) {
		console.error('发送推送出错:', error);
		if (window.updatePushStatus) {
			window.updatePushStatus(`推送出错: ${error.message || '未知错误'}`, 'error');
		}
		return false;
	}
};

// 将二维码数据上传到图片服务器或生成链接
const getQrCodeImageUrl = async (qrCodeData: QRCodeData | null): Promise<string | null> => {
	if (!qrCodeData) {
		enhancedLog('没有二维码数据可供处理');
		return null;
	}
	
	// 如果有base64数据，尝试上传到图片服务器
	if (qrCodeData.base64 && qrCodeData.base64.startsWith('data:image')) {
		enhancedLog('开始上传二维码图片到图片服务器...');
		if (window.updatePushStatus) {
			window.updatePushStatus('正在上传二维码图片...');
		}
		
		const base64Data = qrCodeData.base64;
		
		// 生成随机字母字符串作为文件名
		const length = 6;
		const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
		let randomLetters = '';
		for (let i = 0; i < length; i++) {
			randomLetters += letters.charAt(Math.floor(Math.random() * letters.length));
		}
		
		const fileName = `${randomLetters}.png`;
		const imgdataurl = "https://image.kwxos.pp.ua/healthsimilarlyfrozenroof";
		
		enhancedLog(`生成随机文件名: ${fileName}`);
		
		// 准备上传数据
		const imgdata = {
			base64: base64Data,
			name: fileName
		};
		
		// 上传图片
		const result = await sendHttpRequest(
			imgdataurl,
			{ method: 'POST' },
			imgdata
		);
		const imageUrl = `https://image.kwxos.pp.ua/?key=${fileName}`;
		// enhancedLog('图片上传成功，链接: ' + imageUrl);
		if (window.updatePushStatus) {
			window.updatePushStatus('二维码图片上传成功', 'success');
		}
		// enhancedLog(`${imageUrl}`);
		const qrApiUrl = `https://api.loadke.tech/qrimg?url=${imageUrl}`;
		// enhancedLog(`${qrApiUrl}`);
		const qrApiResult = await sendHttpRequest(
			qrApiUrl,
			{ method: 'GET' },
			null
		);
		// enhancedLog('使用 API 获取二维码 URL 成功: ' + qrApiResult.url);
		const encodedContent = encodeURIComponent(qrApiResult.url);
		return encodedContent;

	}
	
	// 所有方法都失败
	enhancedLog('无法生成二维码图片');
	if (window.updatePushStatus) {
		window.updatePushStatus('无法生成二维码图片', 'error');
	}
	return null;
};

// 发送推送通知
const sendQrCodePushNotification = async (qrCodeData: QRCodeData | null, qrCodeImageUrl: string | null): Promise<boolean> => {
	// enhancedLog('准备发送推送通知');
	
	// 定义推送类型文字
	const pustext = "登录提醒";
	
	if (window.updatePushStatus) {
		window.updatePushStatus('正在发送推送通知...');
	}
	
	try {
		// enhancedLog('推送带有二维码图片和链接的登录提醒');
		// enhancedLog(`${qrCodeData},${qrCodeImageUrl}`);
		const templateHtml = `
			学习强国${pustext}<br><br>
			<a href="dtxuexi://appclient/page/study_feeds?url=${qrCodeImageUrl}" style="display: block;width: 100%;height: 50px;background-color: rgb(40, 122, 228);color: white;text-decoration: none;text-align: center;line-height: 50px;border-radius: 5px;">打开学习强国APP直接登录</a> <span style="display: flex;justify-content: center;align-items: center;padding: 20px;background: #f7f7f7;border-radius: 10px;"><img src="https://api.qrserver.com/v1/create-qr-code?data=${qrCodeImageUrl}" style="width:200px;height:200px;"></span></div>
			<div style="text-align: center; margin-top: 10px; color: #888; font-size: 12px;">
				此消息由学习强国助手自动发送 ${new Date().toLocaleString()}
			</div>
		`;
		
		return await sendPushpush('学习强国登录提醒', templateHtml);

	} catch (error) {
		enhancedLog('发送推送通知失败: ' + error);
		if (window.updatePushStatus) {
			window.updatePushStatus('发送推送失败', 'error');
		}
		
		// 发送最简单的错误恢复通知
		try {
			const errorTemplateHtml = `
				学习强国${pustext}<br><br>
				<a href="dtxuexi://appclient/page/study_feeds" style="display: block;width: 100%;height: 50px;background-color: rgb(40, 122, 228);color: white;text-decoration: none;text-align: center;line-height: 50px;border-radius: 5px;">打开学习强国APP直接登录</a>
				<div style="text-align: center; margin-top: 15px; font-size: 16px; color: #F44336;">
					<p>推送处理过程中出现错误</p>
					<p>请打开学习强国APP进行登录</p>
				</div>
				<div style="text-align: center; margin-top: 10px; color: #888; font-size: 12px;">
					此消息由学习强国助手自动发送 ${new Date().toLocaleString()}
				</div>
			`;
			
			return await sendPushpush('学习强国登录提醒', errorTemplateHtml);
		} catch (backupError) {
			enhancedLog('发送备用推送通知也失败: ' + backupError);
			return false;
		}
	}
};

// 主要的QR码处理流程
const processAndSendQrCode = async () => {
	// enhancedLog('开始处理登录二维码推送流程');
	
	// 显示推送进度信息
	let pushStatusMessage = '正在准备推送登录二维码...';
	if (shortTermPushCount > 0) {
		pushStatusMessage += `（第 ${shortTermPushCount}/${MAX_SHORT_TERM_PUSH} 次推送）`;
	}
	
	if (window.updatePushStatus) {
		window.updatePushStatus(pushStatusMessage);
	}
	
	try {
		// 直接使用截图方式获取二维码，简化整个流程
		// enhancedLog('使用截图方式获取二维码');
		if (window.updatePushStatus) {
			let statusMessage = '正在截取屏幕获取二维码...';
			if (shortTermPushCount > 0) {
				statusMessage += `（第 ${shortTermPushCount}/${MAX_SHORT_TERM_PUSH} 次推送）`;
			}
			window.updatePushStatus(statusMessage);
		}
		
		// 在截图前等待3秒，确保页面完全渲染
		enhancedLog('等待3秒确保页面完全渲染...');
		await new Promise(resolve => setTimeout(resolve, 3000));
		
		// 请求截图
		const result = await ipcRenderer.invoke('capture-qrcode');
		
		if (!result || !result.success) {
			enhancedLog('截图失败: ' + (result ? result.error : '未知错误'));
			if (window.updatePushStatus) {
				window.updatePushStatus('获取二维码失败: ' + (result ? result.error : '未知错误'), 'error');
			}
			
			// 截图失败，尝试发送基本通知
			await sendQrCodePushNotification(null, null);
			return;
		}
		
		// enhancedLog('截图成功: ' + result.path);
		if (window.updatePushStatus) {
			let statusMessage = '获取二维码成功，正在推送...';
			if (shortTermPushCount > 0) {
				statusMessage += `（第 ${shortTermPushCount}/${MAX_SHORT_TERM_PUSH} 次推送）`;
			}
			window.updatePushStatus(statusMessage, 'success');
		}
		
		// 构建二维码数据对象
		const qrCodeData: QRCodeData = {
			content: null,
			base64: `data:image/png;base64,${result.base64}`
		};
		
		// 获取图片URL
		const qrCodeImageUrl = await getQrCodeImageUrl(qrCodeData);
		
		// 发送推送通知
		const pushResult = await sendQrCodePushNotification(qrCodeData, qrCodeImageUrl);
		
		// 记录推送时间
		if (pushResult) {
			localStorage.setItem('last-qr-notification-time', new Date().getTime().toString());
			// enhancedLog('推送成功，已记录推送时间');
			if (window.updatePushStatus) {
				let statusMessage = '推送成功！二维码已发送到您的设备';
				if (shortTermPushCount > 0) {
					statusMessage += `（第 ${shortTermPushCount}/${MAX_SHORT_TERM_PUSH} 次推送）`;
				}
				window.updatePushStatus(statusMessage, 'success');
				if (shortTermPushCount === MAX_SHORT_TERM_PUSH) {
					enhancedLog('已达到最大短期推送次数限制，回归每日推送模式');
					updatePushCountDisplay();
					clearAllPushTimers();
					scheduleDailyPush();
				}
			}
		} else {
			enhancedLog('推送失败');
			if (window.updatePushStatus) {
				let statusMessage = '推送失败';
				if (shortTermPushCount > 0) {
					statusMessage += `（第 ${shortTermPushCount}/${MAX_SHORT_TERM_PUSH} 次推送）`;
				}
				window.updatePushStatus(statusMessage, 'error');
			}
		}
		
		// 删除临时图片文件
		if (result && result.path) {
			try {
				// enhancedLog('正在删除临时二维码图片文件: ' + result.path);
				const deleteResult = await ipcRenderer.invoke('delete-temp-qrcode', result.path);
				if (deleteResult && deleteResult.success) {
					// enhancedLog('临时二维码图片文件已删除');
				} else {
					enhancedLog('删除临时二维码图片文件失败: ' + (deleteResult ? deleteResult.error : '未知错误'));
				}
			} catch (deleteError) {
				enhancedLog('删除临时文件出错: ' + deleteError);
			}
		}
	} catch (error) {
		enhancedLog('处理二维码推送流程失败: ' + error);
		if (window.updatePushStatus) {
			window.updatePushStatus('处理二维码失败', 'error');
		}
		
		// 尝试发送错误恢复通知
		await sendQrCodePushNotification(null, null);
	}
};

// 简化截图并推送二维码功能，与processAndSendQrCode共用逻辑
const captureAndPushQrCode = async () => {
	// 直接调用主处理函数，现在它已经使用截图方式
	await processAndSendQrCode();
};

// 检查是否是首次启动
const isFirstLaunch = (): boolean => {
	return localStorage.getItem('last-qr-notification-time') === null;
};

// 检查是否应该推送（首次启动或已到推送时间）
const checkShouldPush = (): boolean => {
	// 如果正在短期推送序列中，不应该重新触发推送判断
	if (isInShortTermSequence || localStorage.getItem('is-in-short-term-sequence') === 'true') {
		enhancedLog('正在短期推送序列中，跳过推送判断');
		return false;
	}
	
	// 如果是首次启动，应该推送
	if (isFirstLaunch()) {
		// enhancedLog('首次启动，应该推送二维码');
		return false;
	}
	
	// 如果开启了每日推送
	if (isDailyPushEnabled()) {
		const now = new Date();
		const lastPushDate = localStorage.getItem('last-qr-notification-date');
		
		// 如果今天还没有推送过
		if (lastPushDate !== now.toDateString()) {
			const [hours, minutes] = getAutoPushTimeValue().split(':').map(Number);
			const targetTime = new Date();
			targetTime.setHours(hours, minutes, 0, 0);
			
			// 如果当前时间已经过了设定的推送时间
			if (now.getTime() >= targetTime.getTime()) {
				enhancedLog('已到达设定的推送时间，开始短期推送流程');
				return true;
			}
		}
	}
	
	return false;
};

// 刷新页面并推送二维码
const refreshPageAndPushQrCode = async () => {
	// enhancedLog('刷新页面以获取最新二维码');
	
	if (window.updatePushStatus) {
		let statusMessage = '正在刷新页面获取最新二维码...';
		if (shortTermPushCount > 0) {
			statusMessage += `（第 ${shortTermPushCount}/${MAX_SHORT_TERM_PUSH} 次推送）`;
		}
		window.updatePushStatus(statusMessage);
	}
	
	try {
		// 刷新当前页面
		const currentUrl = window.location.href;
		// enhancedLog(`当前页面URL: ${currentUrl}`);
		
		// 设置刷新后推送的标记
		localStorage.setItem('waiting-for-refresh-push', 'true');
		
		// 通知主进程刷新页面
		await ipcRenderer.invoke('refresh-page');
		
		// enhancedLog('页面刷新请求已发送');
		
	} catch (error) {
		enhancedLog('刷新页面失败: ' + error);
		
		// 清除刷新标记
		localStorage.removeItem('waiting-for-refresh-push');
		
		if (window.updatePushStatus) {
			window.updatePushStatus('刷新页面失败，尝试直接推送...', 'error');
		}
		
		// 如果刷新失败，尝试直接推送当前二维码
		try {
			await processAndSendQrCode();
			
			// 记录推送时间
			localStorage.setItem('last-qr-notification-time', new Date().getTime().toString());
			localStorage.setItem('last-qr-notification-date', new Date().toDateString());
			
		} catch (pushError) {
			enhancedLog('推送二维码失败: ' + pushError);
		}
	}
};

// 开始短期推送序列（规定时间到达时触发）
const startShortTermPushSequence = () => {
	enhancedLog('开始短期推送序列');
	
	// 设置短期推送序列标记
	isInShortTermSequence = true;
	localStorage.setItem('is-in-short-term-sequence', 'true');
	
	// 重置短期推送计数
	shortTermPushCount = 0;
	updatePushCountDisplay();
	
	// 清除现有的短期推送定时器
	if (shortTermPushTimer) {
		clearTimeout(shortTermPushTimer);
		shortTermPushTimer = null;
	}
	
	// 立即执行第一次推送
	executeShortTermPush();
};
