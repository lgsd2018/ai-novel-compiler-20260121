import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { getDocumentsByIds } from './db';

// Redis 连接配置
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// 发布任务队列
export const publishQueue = new Queue('publishing', { connection });

// 任务数据结构
interface PublishJobData {
  taskId: number;
  userId: number;
  projectId: number;
  platform: 'qidian' | 'jinjiang';
  accountId: number;
  documentIds: number[];
  config: {
    bookTitle: string;
    bookIntro: string;
    category: string;
    tags: string[];
    coverUrl?: string;
  };
}

// 发布任务处理器
export const publishWorker = new Worker<PublishJobData>(
  'publishing',
  async (job: Job<PublishJobData>, _token?: string, signal?: AbortSignal) => {
    const { taskId, userId, projectId, platform, accountId, documentIds, config } = job.data;
    // 用于在运行中感知取消信号
    let aborted = false;
    const abortHandler = () => {
      aborted = true;
    };
    signal?.addEventListener('abort', abortHandler);

    try {
      // 如果已被取消，直接终止
      if (aborted) {
        throw new Error('Job cancelled');
      }
      // 更新任务状态为处理中
      await job.updateProgress(0);
      await job.log(`开始发布任务 #${taskId} 到 ${platform}`);

      // 获取文档内容
      const documents = await getDocumentsByIds(documentIds);
      if (!documents || documents.length === 0) {
        throw new Error('未找到要发布的文档');
      }

      await job.updateProgress(10);

      // 根据平台调用不同的发布函数
      let result;
      // TODO: 实现真实的发布逻辑
      // 目前仅模拟发布过程
      for (let i = 0; i < documents.length; i++) {
        if (aborted) {
          throw new Error('Job cancelled');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        await job.updateProgress(10 + ((i + 1) / documents.length) * 80);
      }
      
      result = {
        success: true,
        platform,
        publishedChapters: documents.length,
        message: `Successfully published ${documents.length} chapters to ${platform}`,
      };

      await job.updateProgress(100);
      await job.log(`发布任务 #${taskId} 完成`);

      return {
        success: true,
        taskId,
        platform,
        result,
      };
    } catch (error) {
      await job.log(`发布任务 #${taskId} 失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      signal?.removeEventListener('abort', abortHandler);
    }
  },
  {
    connection,
    concurrency: 3, // 同时处理3个任务
  }
);

// 任务管理函数
export async function addPublishTask(data: PublishJobData) {
  const job = await publishQueue.add('publish', data, {
    attempts: 3, // 失败重试3次
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
  return job.id;
}

export async function getTaskStatus(jobId: string) {
  const job = await publishQueue.getJob(jobId);
  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;
  const logs = { logs: [] as string[] };

  return {
    id: job.id,
    status: state,
    state,
    progress,
    logs: logs.logs,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
    timestamp: job.timestamp,
    name: job.name,
  };
}

export async function pauseTask(jobId: string) {
  const job = await publishQueue.getJob(jobId);
  if (job) {
    return false;
  }
  return false;
}

export async function resumeTask(jobId: string) {
  const job = await publishQueue.getJob(jobId);
  if (job) {
    return false;
  }
  return false;
}

// 取消任务，活跃任务使用取消信号，其余任务直接移除
export async function cancelTask(jobId: string) {
  const job = await publishQueue.getJob(jobId);
  if (job) {
    const isActive = await job.isActive();
    if (isActive) {
      const cancelled = await publishWorker.cancelJob(String(job.id));
      if (cancelled) {
        return true;
      }
    }
    try {
      await job.remove();
      return true;
    } catch {
      return isActive;
    }
  }
  return false;
}

// 获取所有任务
export async function getAllTasks(userId: number) {
  const jobs = await publishQueue.getJobs(['waiting', 'active', 'completed', 'failed']);
  const userJobs = jobs.filter(job => job.data.userId === userId);
  
  return Promise.all(userJobs.map(async job => ({
    id: job.id,
    status: await job.getState(),
    state: await job.getState(),
    progress: job.progress,
    data: job.data,
    timestamp: job.timestamp,
    name: job.name,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
  })));
}
