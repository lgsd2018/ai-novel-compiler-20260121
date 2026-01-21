/**
 * Jinjiang (晋江文学城) Platform API Integration
 * 
 * Note: This is a reference implementation based on typical web novel platform APIs.
 * Actual API endpoints and authentication methods may vary.
 * You need to register as a developer on Jinjiang's platform to get official API access.
 */

import axios, { AxiosInstance } from "axios";

export interface JinjiangConfig {
  username: string;
  password?: string;
  apiKey?: string;
  accessToken?: string;
}

export interface JinjiangWork {
  id: string;
  title: string;
  description: string;
  coverUrl?: string;
  category: string;
  tags: string[];
  status: "draft" | "serializing" | "completed";
  isOriginal: boolean; // 原创/同人
  rating: "general" | "teen" | "mature"; // 分级
}

export interface JinjiangChapter {
  title: string;
  content: string;
  wordCount: number;
  order: number;
  isVIP: boolean; // VIP章节
  authorNote?: string; // 作者的话
  publishTime?: Date;
}

export class JinjiangAPI {
  private client: AxiosInstance;
  private config: JinjiangConfig;
  private baseURL = "https://api.jjwxc.net"; // Placeholder URL

  constructor(config: JinjiangConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "NovelCompiler/1.0",
      },
    });

    // Add auth interceptor
    this.client.interceptors.request.use((config) => {
      if (this.config.accessToken) {
        config.headers.Authorization = `Bearer ${this.config.accessToken}`;
      } else if (this.config.apiKey) {
        config.headers["X-API-Key"] = this.config.apiKey;
      }
      return config;
    });
  }

  /**
   * Authenticate with username/password
   */
  async authenticate(): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    try {
      const response = await this.client.post("/auth/login", {
        username: this.config.username,
        password: this.config.password,
      });

      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      throw new Error(`Jinjiang authentication failed: ${error.message}`);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const response = await this.client.post("/auth/refresh", {
        refresh_token: refreshToken,
      });

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
      };
    } catch (error: any) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Create a new work
   */
  async createWork(work: Omit<JinjiangWork, "id">): Promise<JinjiangWork> {
    try {
      const response = await this.client.post("/works", {
        title: work.title,
        description: work.description,
        cover_url: work.coverUrl,
        category: work.category,
        tags: work.tags,
        status: work.status,
        is_original: work.isOriginal,
        rating: work.rating,
      });

      return {
        id: response.data.work_id,
        title: response.data.title,
        description: response.data.description,
        coverUrl: response.data.cover_url,
        category: response.data.category,
        tags: response.data.tags,
        status: response.data.status,
        isOriginal: response.data.is_original,
        rating: response.data.rating,
      };
    } catch (error: any) {
      throw new Error(`Failed to create work: ${error.message}`);
    }
  }

  /**
   * Update work information
   */
  async updateWork(workId: string, updates: Partial<Omit<JinjiangWork, "id">>): Promise<void> {
    try {
      await this.client.put(`/works/${workId}`, {
        title: updates.title,
        description: updates.description,
        cover_url: updates.coverUrl,
        category: updates.category,
        tags: updates.tags,
        status: updates.status,
        is_original: updates.isOriginal,
        rating: updates.rating,
      });
    } catch (error: any) {
      throw new Error(`Failed to update work: ${error.message}`);
    }
  }

  /**
   * Get work details
   */
  async getWork(workId: string): Promise<JinjiangWork> {
    try {
      const response = await this.client.get(`/works/${workId}`);

      return {
        id: response.data.work_id,
        title: response.data.title,
        description: response.data.description,
        coverUrl: response.data.cover_url,
        category: response.data.category,
        tags: response.data.tags,
        status: response.data.status,
        isOriginal: response.data.is_original,
        rating: response.data.rating,
      };
    } catch (error: any) {
      throw new Error(`Failed to get work: ${error.message}`);
    }
  }

  /**
   * Upload a chapter
   */
  async uploadChapter(workId: string, chapter: JinjiangChapter): Promise<{ chapterId: string }> {
    try {
      const response = await this.client.post(`/works/${workId}/chapters`, {
        title: chapter.title,
        content: chapter.content,
        word_count: chapter.wordCount,
        order: chapter.order,
        is_vip: chapter.isVIP,
        author_note: chapter.authorNote,
        publish_time: chapter.publishTime?.toISOString(),
      });

      return {
        chapterId: response.data.chapter_id,
      };
    } catch (error: any) {
      throw new Error(`Failed to upload chapter: ${error.message}`);
    }
  }

  /**
   * Update a chapter
   */
  async updateChapter(workId: string, chapterId: string, updates: Partial<JinjiangChapter>): Promise<void> {
    try {
      await this.client.put(`/works/${workId}/chapters/${chapterId}`, {
        title: updates.title,
        content: updates.content,
        word_count: updates.wordCount,
        is_vip: updates.isVIP,
        author_note: updates.authorNote,
      });
    } catch (error: any) {
      throw new Error(`Failed to update chapter: ${error.message}`);
    }
  }

  /**
   * Delete a chapter
   */
  async deleteChapter(workId: string, chapterId: string): Promise<void> {
    try {
      await this.client.delete(`/works/${workId}/chapters/${chapterId}`);
    } catch (error: any) {
      throw new Error(`Failed to delete chapter: ${error.message}`);
    }
  }

  /**
   * Get all chapters of a work
   */
  async getChapters(workId: string): Promise<Array<JinjiangChapter & { id: string }>> {
    try {
      const response = await this.client.get(`/works/${workId}/chapters`);

      return response.data.chapters.map((ch: any) => ({
        id: ch.chapter_id,
        title: ch.title,
        content: ch.content,
        wordCount: ch.word_count,
        order: ch.order,
        isVIP: ch.is_vip,
        authorNote: ch.author_note,
        publishTime: ch.publish_time ? new Date(ch.publish_time) : undefined,
      }));
    } catch (error: any) {
      throw new Error(`Failed to get chapters: ${error.message}`);
    }
  }

  /**
   * Batch upload chapters
   */
  async batchUploadChapters(workId: string, chapters: JinjiangChapter[]): Promise<{ successCount: number; failedCount: number; errors: string[] }> {
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const chapter of chapters) {
      try {
        await this.uploadChapter(workId, chapter);
        successCount++;
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        failedCount++;
        errors.push(`Chapter "${chapter.title}": ${error.message}`);
      }
    }

    return { successCount, failedCount, errors };
  }

  /**
   * Lock chapter (make it VIP)
   */
  async lockChapter(workId: string, chapterId: string): Promise<void> {
    try {
      await this.client.post(`/works/${workId}/chapters/${chapterId}/lock`);
    } catch (error: any) {
      throw new Error(`Failed to lock chapter: ${error.message}`);
    }
  }

  /**
   * Unlock chapter (make it free)
   */
  async unlockChapter(workId: string, chapterId: string): Promise<void> {
    try {
      await this.client.post(`/works/${workId}/chapters/${chapterId}/unlock`);
    } catch (error: any) {
      throw new Error(`Failed to unlock chapter: ${error.message}`);
    }
  }
}

/**
 * Create Jinjiang API client with config
 */
export function createJinjiangClient(config: JinjiangConfig): JinjiangAPI {
  return new JinjiangAPI(config);
}
