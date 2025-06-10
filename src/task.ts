import { ipcRenderer } from 'electron';
import { getArticleChannels, getVideoChannels } from './channels';
import { getUsableRateScoreTasks, isDone, showScoreDetail } from './score';
import { getRandomElement, delay, notify } from './utils';
import { config } from './config';
import { sendPushpush, getPushpushToken, isPushpushEnabled } from './login';
import { getTotalScore, getTodayTotalScore } from './score';

export default class Task {
  private articleChannels: any[] = [];
  private videoChannels: any[] = [];
	public answerRunning: boolean = false;
  private allTasksCompleted: boolean = false;  // 添加任务完成状态追踪

  constructor() {
    this.watch();
  }

  async initialize() {
    // 先初始化PushPush配置
    try {
      const { getPushpushConfig } = await import('./login');
      await getPushpushConfig();
      ipcRenderer.send('log', '初始化时已同步PushPush配置');
      ipcRenderer.send('log', '初始化Token值:', getPushpushToken());
      ipcRenderer.send('log', '初始化Enabled值:', isPushpushEnabled());
    } catch (error) {
      ipcRenderer.send('log', '初始化时同步PushPush配置失败:', error);
    }
    
    const articleChannels = this.articleChannels = await getArticleChannels();
    const videoChannels = this.videoChannels = await getVideoChannels();

    ipcRenderer.send('set-article-channels', articleChannels);
    ipcRenderer.send('set-video-channels', videoChannels);
  }

  async startArticleTask() {
    const [
      watchArticleTask,
      ,
      watchArticleTimeTask,
      ,
    ] = await getUsableRateScoreTasks();

    if (isDone(watchArticleTask) && isDone(watchArticleTimeTask)) {
      return;
    }

    const channel = getRandomElement(this.articleChannels);
    ipcRenderer.send('log', '文章地址：', channel.url);
    ipcRenderer.send('create-article-view', {
      url: channel.url,
    });
  };

  async startVideoTask() {
    const [
      ,
      watchVideoTask,
      ,
      watchVideoTimeTask,
    ] = await getUsableRateScoreTasks();

    if (isDone(watchVideoTask) && isDone(watchVideoTimeTask)) {
      return;
    }

    const channel = getRandomElement(this.videoChannels);
    ipcRenderer.send('log', '视频地址：', channel.url);
    ipcRenderer.send('create-video-view', {
      url: channel.url,
    });
  };

  async startFastVideoTask() {
    const [
      ,
      watchVideoTask,
      ,
      watchVideoTimeTask,
    ] = await getUsableRateScoreTasks();

    if (isDone(watchVideoTask) && isDone(watchVideoTimeTask)) {
      return;
    }

    const channel = getRandomElement(this.videoChannels);
    ipcRenderer.send('log', '快速视频地址：', channel.url);
    ipcRenderer.send('create-fast-video-view', {
      url: channel.url,
    });
  };

  async checkIsOver() {
    const [
      watchArticleTask,
      watchVideoTask,
      watchArticleTimeTask,
      watchVideoTimeTask,
    ] = await getUsableRateScoreTasks();

    if (
      isDone(watchArticleTask) &&
      isDone(watchVideoTask) &&
      isDone(watchArticleTimeTask) &&
      isDone(watchVideoTimeTask)
    ) {
      ipcRenderer.send('close-task');
      // 开启，让 notification 有提示音
      ipcRenderer.send('set-app-audio-muted', false);

      notify({ body: `${config.tipsPrefix}今日积分已经满啦`});
      const $tips: HTMLElement = document.getElementById('task-tips');
      $tips.innerHTML = '恭喜，今日积分已满';
      $tips.style.color = '#ff0000';
      
      // 先同步获取最新配置
      try {
        // 从login.ts导入getPushpushConfig函数
        const { getPushpushConfig } = await import('./login');
        await getPushpushConfig();
        ipcRenderer.send('log', '已同步PushPush配置');
      } catch (error) {
        ipcRenderer.send('log', '同步PushPush配置失败:', error);
      }
      
      ipcRenderer.send('log', '当前PushPush Token：', getPushpushToken());
      if (isPushpushEnabled() && getPushpushToken()) {
        const date = new Date();
        const totalScore = await getTotalScore();
        const todayTotalScore = await getTodayTotalScore();
        const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
        sendPushpush('学习强国任务完成', `
          <div style="padding: 15px; background-color: #f8f8f8; border-radius: 10px;">
            <h2 style="color: #2196F3; text-align: center;">学习强国任务完成通知</h2>
            <p style="font-size: 16px;">你好同学，您的学习强国今日任务已全部完成！</p>
            <p style="font-size: 14px; color: #666;">完成时间：${dateStr}</p>
            <p style="font-size: 14px; color: #666;">总积分：${totalScore}  今日积分：${todayTotalScore}</p>
            <p style="font-size: 14px; color: #666;">所有学习任务已完成，积分已经满啦！</p>
            <div style="text-align: center; margin-top: 20px; color: #888; font-size: 12px;">
              此消息由学习强国助手自动发送
            </div>
          </div>
        `);
      }
    }
  };

  watch() {
    ipcRenderer.on('watch-article', async () => {
      showScoreDetail();
      this.checkIsOver();
    });

    ipcRenderer.on('watch-video', () => {
      showScoreDetail();
      this.checkIsOver();
    });
  }

	dayAnswer() {
		setTimeout(() => {
			ipcRenderer.send('answer-the-question', 'day');
		}, 60000);
	}

  answer() {
		this.answerRunning = true;
    setTimeout(() => {
      ipcRenderer.send('answer-the-question', 'weekly');
    }, 120000);
    setTimeout(() => {
      ipcRenderer.send('answer-the-question', 'special');
    }, 180000);
  }

  async runTask() {
    try {
      await this.initialize();
      await showScoreDetail();
      await this.startArticleTask();
      await delay(1000);
      await this.startArticleTask();
      await delay(1000);
      await this.startVideoTask();
      await delay(1000);
      await this.startFastVideoTask();
      await delay(1000);
      await this.startFastVideoTask();
			await delay(1000);
			await this.dayAnswer();
      this.checkIsOver();
    } catch (error) {
      console.log(error);
    }
  };

	retry() {
		ipcRenderer.send('close-task');
		this.runTask();
	}
}
