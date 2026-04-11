import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('DEV_MODE ローカル自立化', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('env.ts', () => {
    it('DEV_MODE=true のとき devMode が true になる', async () => {
      process.env.DEV_MODE = 'true';
      const { ENV } = await import('./_core/env');
      expect(ENV.devMode).toBe(true);
    });

    it('DEV_MODE 未設定のとき devMode が false になる', async () => {
      delete process.env.DEV_MODE;
      const { ENV } = await import('./_core/env');
      expect(ENV.devMode).toBe(false);
    });

    it('JWT_SECRET 未設定でもデフォルト値が使われる', async () => {
      delete process.env.JWT_SECRET;
      const { ENV } = await import('./_core/env');
      expect(ENV.cookieSecret).toBe('dev-secret-key-change-in-production');
    });

    it('JWT_SECRET 設定時はその値が使われる', async () => {
      process.env.JWT_SECRET = 'my-secret';
      const { ENV } = await import('./_core/env');
      expect(ENV.cookieSecret).toBe('my-secret');
    });
  });

  describe('bunnyStream.ts — isBunnyConfigured ガード', () => {
    it('BUNNY_STREAM_API_KEY 未設定時に listBunnyVideos は空配列を返す', async () => {
      delete process.env.BUNNY_STREAM_API_KEY;
      delete process.env.BUNNY_STREAM_LIBRARY_ID;
      const { listBunnyVideos } = await import('./bunnyStream');
      const result = await listBunnyVideos();
      expect(result).toEqual({ totalItems: 0, currentPage: 1, itemsPerPage: 100, items: [] });
    });

    it('BUNNY_STREAM_API_KEY 未設定時に createBunnyVideo はエラーを投げる', async () => {
      delete process.env.BUNNY_STREAM_API_KEY;
      delete process.env.BUNNY_STREAM_LIBRARY_ID;
      const { createBunnyVideo } = await import('./bunnyStream');
      await expect(createBunnyVideo('test')).rejects.toThrow('[Bunny] API not configured');
    });
  });

  describe('storage.ts — ローカルフォールバック', () => {
    it('Forge API 未設定時に storagePut がローカルファイルに保存する', async () => {
      delete process.env.BUILT_IN_FORGE_API_URL;
      delete process.env.BUILT_IN_FORGE_API_KEY;
      
      const { storagePut } = await import('./storage');
      // ローカルフォールバック時はlocal-storageディレクトリに保存される
      const result = await storagePut('test/file.png', Buffer.from('test'), 'image/png');
      
      expect(result.key).toBe('test/file.png');
      expect(result.url).toContain('local-storage');
      
      // クリーンアップ: テストで作成されたファイルを削除
      const fs = await import('fs');
      const path = await import('path');
      try {
        fs.unlinkSync(path.join(process.cwd(), 'local-storage', 'test', 'file.png'));
        fs.rmdirSync(path.join(process.cwd(), 'local-storage', 'test'));
      } catch (e) { /* ignore cleanup errors */ }
    });

    it('Forge API 未設定時に getStorageApiKey は空文字を返す', async () => {
      delete process.env.BUILT_IN_FORGE_API_URL;
      delete process.env.BUILT_IN_FORGE_API_KEY;
      const { getStorageApiKey } = await import('./storage');
      expect(getStorageApiKey()).toBe('');
    });
  });

  describe('notification.ts — 未設定時のフォールバック', () => {
    it('Forge API 未設定時に notifyOwner は true を返す（ログのみ）', async () => {
      delete process.env.BUILT_IN_FORGE_API_URL;
      delete process.env.BUILT_IN_FORGE_API_KEY;
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { notifyOwner } = await import('./_core/notification');
      const result = await notifyOwner({ title: 'Test', content: 'Test content' });
      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('skipped, not configured'));
      consoleSpy.mockRestore();
    });
  });

  describe('gbp.ts — 未設定時のガード', () => {
    it('GBP 未設定時に isGBPConfigured は false を返す', async () => {
      delete process.env.GBP_CLIENT_ID;
      delete process.env.GBP_CLIENT_SECRET;
      delete process.env.GBP_REFRESH_TOKEN;
      const { isGBPConfigured } = await import('./_core/gbp');
      expect(isGBPConfigured()).toBe(false);
    });

    it('GBP 未設定時に getLocalPosts は空配列を返す', async () => {
      delete process.env.GBP_CLIENT_ID;
      delete process.env.GBP_CLIENT_SECRET;
      delete process.env.GBP_REFRESH_TOKEN;
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { getLocalPosts } = await import('./_core/gbp');
      const posts = await getLocalPosts();
      expect(posts).toEqual([]);
      consoleSpy.mockRestore();
    });
  });
});
