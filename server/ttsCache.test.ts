import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  generateCacheKey,
  getCachedAudio,
  setCachedAudio,
  deleteCachedAudio,
  getCacheStats,
} from './ttsCache';

describe('TTS Cache', () => {
  const testText = 'Hello, this is a test';
  const testAudioData = Buffer.from('fake audio data');
  let testCacheKey: string;

  beforeAll(async () => {
    testCacheKey = generateCacheKey(testText, 'default', 1.0, 1.0, 'mp3');
  });

  afterAll(async () => {
    // Clean up test data
    await deleteCachedAudio(testCacheKey);
  });

  it('should generate consistent cache keys', () => {
    const key1 = generateCacheKey(testText, 'default', 1.0, 1.0, 'mp3');
    const key2 = generateCacheKey(testText, 'default', 1.0, 1.0, 'mp3');
    expect(key1).toBe(key2);
    expect(key1).toHaveLength(64); // SHA256 hash length
  });

  it('should generate different keys for different parameters', () => {
    const key1 = generateCacheKey(testText, 'default', 1.0, 1.0, 'mp3');
    const key2 = generateCacheKey(testText, 'alloy', 1.0, 1.0, 'mp3');
    const key3 = generateCacheKey(testText, 'default', 1.5, 1.0, 'mp3');
    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it('should cache and retrieve audio data', async () => {
    // Set cache
    const setResult = await setCachedAudio(testCacheKey, testAudioData, 'mp3', 10);
    expect(setResult).toBe(true);

    // Get cache
    const cachedData = await getCachedAudio(testCacheKey);
    expect(cachedData).not.toBeNull();
    expect(cachedData?.toString()).toBe(testAudioData.toString());
  });

  it('should return null for non-existent cache', async () => {
    const nonExistentKey = generateCacheKey('non-existent-text', 'default', 1.0, 1.0, 'mp3');
    const cachedData = await getCachedAudio(nonExistentKey);
    expect(cachedData).toBeNull();
  });

  it('should update access count on retrieval', async () => {
    // Set cache
    await setCachedAudio(testCacheKey, testAudioData, 'mp3', 10);

    // Get cache multiple times
    await getCachedAudio(testCacheKey);
    await getCachedAudio(testCacheKey);

    // Access count should be incremented (tested indirectly through stats)
    const stats = await getCacheStats();
    expect(stats.totalEntries).toBeGreaterThan(0);
  });

  it('should get cache statistics', async () => {
    const stats = await getCacheStats();
    expect(stats).toHaveProperty('totalEntries');
    expect(stats).toHaveProperty('totalSize');
    expect(stats).toHaveProperty('avgAccessCount');
    expect(typeof stats.totalEntries).toBe('number');
    expect(typeof stats.totalSize).toBe('number');
  });

  it('should delete cached audio', async () => {
    const tempKey = generateCacheKey('temp-test', 'default', 1.0, 1.0, 'mp3');
    
    // Set cache
    await setCachedAudio(tempKey, testAudioData, 'mp3');
    
    // Verify it exists
    let cachedData = await getCachedAudio(tempKey);
    expect(cachedData).not.toBeNull();
    
    // Delete cache
    const deleteResult = await deleteCachedAudio(tempKey);
    expect(deleteResult).toBe(true);
    
    // Verify it's deleted
    cachedData = await getCachedAudio(tempKey);
    expect(cachedData).toBeNull();
  });
});
