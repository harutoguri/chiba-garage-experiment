import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { ENV } from "./env";
import { sdk } from "./sdk";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/**
 * DEV_MODE用の固定ユーザー。
 * OAuth不要で管理画面にアクセス可能。
 */
const DEV_USER: User = {
  id: 1,
  openId: "dev-admin-user",
  name: "開発用管理者",
  email: "dev@localhost",
  loginMethod: "dev",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // DEV_MODE: OAuthをバイパスして固定管理者ユーザーを返す
  if (ENV.devMode) {
    // DBがある場合はDBのユーザーを使う、なければ固定ユーザー
    try {
      const dbUser = await db.getUserByOpenId("dev-admin-user");
      user = dbUser || DEV_USER;
    } catch {
      user = DEV_USER;
    }
    return { req: opts.req, res: opts.res, user };
  }

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
