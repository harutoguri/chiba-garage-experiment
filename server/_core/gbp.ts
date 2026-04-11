/**
 * Google Business Profile API連携モジュール
 * localPostsを取得してキャッシュする
 */

import { ENV } from "./env";

// 固定のアカウントID・ロケーションID
const GBP_ACCOUNT_ID = "101237390287046333244";
const GBP_LOCATION_ID = "3896845022454025521";

// キャッシュ設定（6時間）
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// キャッシュ用の型定義
interface GBPPost {
  name: string;
  languageCode: string;
  summary: string;
  state: string;
  createTime: string;
  updateTime: string;
  searchUrl: string;
  media?: Array<{
    mediaFormat: string;
    googleUrl: string;
  }>;
  topicType?: string;
}

interface CachedData {
  posts: GBPPost[];
  fetchedAt: number;
}

// メモリキャッシュ
let cache: CachedData | null = null;

/**
 * アクセストークンをリフレッシュトークンから取得
 */
async function getAccessToken(): Promise<string | null> {
  const { gbpClientId, gbpClientSecret, gbpRefreshToken } = ENV;
  
  if (!gbpClientId || !gbpClientSecret || !gbpRefreshToken) {
    console.error("GBP credentials not configured");
    return null;
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: gbpClientId,
        client_secret: gbpClientSecret,
        refresh_token: gbpRefreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to refresh token:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

/**
 * Google Business Profile APIからlocalPostsを取得
 */
async function fetchLocalPosts(): Promise<GBPPost[]> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return [];
  }

  try {
    const url = `https://mybusiness.googleapis.com/v4/accounts/${GBP_ACCOUNT_ID}/locations/${GBP_LOCATION_ID}/localPosts`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch localPosts:", response.status, errorText);
      return [];
    }

    const data = await response.json();
    return data.localPosts || [];
  } catch (error) {
    console.error("Error fetching localPosts:", error);
    return [];
  }
}

/**
 * キャッシュされたlocalPostsを取得（キャッシュが古い場合は再取得）
 */
export async function getLocalPosts(limit: number = 5): Promise<GBPPost[]> {
  const now = Date.now();

  // キャッシュが有効な場合はキャッシュを返す
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.posts.slice(0, limit);
  }

  // キャッシュが無効または存在しない場合は再取得
  const posts = await fetchLocalPosts();
  
  // 最新順にソート（createTimeの降順）
  posts.sort((a, b) => {
    const dateA = new Date(a.createTime).getTime();
    const dateB = new Date(b.createTime).getTime();
    return dateB - dateA;
  });

  // キャッシュを更新
  cache = {
    posts,
    fetchedAt: now,
  };

  return posts.slice(0, limit);
}

/**
 * キャッシュを強制的にクリア
 */
export function clearCache(): void {
  cache = null;
}

/**
 * GBP認証情報が設定されているかチェック
 */
export function isGBPConfigured(): boolean {
  const { gbpClientId, gbpClientSecret, gbpRefreshToken } = ENV;
  return !!(gbpClientId && gbpClientSecret && gbpRefreshToken);
}
