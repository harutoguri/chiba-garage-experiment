import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  getPublishedVehicles: vi.fn().mockResolvedValue([
    {
      id: 1,
      title: "TOYOTA LAND CRUISER PRADO",
      price: 2480000,
      priceDisplay: "2,480,000",
      videoUrl: null,
      thumbnailUrl: null,
      description: "黒革シート、サンルーフ",
      status: "在庫あり",
      displayOrder: 0,
      isPublished: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getAllVehicles: vi.fn().mockResolvedValue([
    {
      id: 1,
      title: "TOYOTA LAND CRUISER PRADO",
      price: 2480000,
      priceDisplay: "2,480,000",
      videoUrl: null,
      thumbnailUrl: null,
      description: "黒革シート、サンルーフ",
      status: "在庫あり",
      displayOrder: 0,
      isPublished: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      title: "非公開車両",
      price: 1000000,
      priceDisplay: "1,000,000",
      videoUrl: null,
      thumbnailUrl: null,
      description: "非公開",
      status: "売約済み",
      displayOrder: 1,
      isPublished: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getVehicleById: vi.fn().mockImplementation((id: number) => {
    if (id === 1) {
      return Promise.resolve({
        id: 1,
        title: "TOYOTA LAND CRUISER PRADO",
        price: 2480000,
        priceDisplay: "2,480,000",
        videoUrl: null,
        thumbnailUrl: null,
        description: "黒革シート、サンルーフ",
        status: "在庫あり",
        displayOrder: 0,
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return Promise.resolve(undefined);
  }),
  createVehicle: vi.fn().mockResolvedValue({ insertId: 3 }),
  updateVehicle: vi.fn().mockResolvedValue(undefined),
  deleteVehicle: vi.fn().mockResolvedValue(undefined),
  deleteAllVehicleMedia: vi.fn().mockResolvedValue(undefined),
  getVehicleMedia: vi.fn().mockResolvedValue([]),
  getVehicleMediaById: vi.fn().mockResolvedValue(undefined),
  createVehicleMedia: vi.fn().mockResolvedValue({ insertId: 1 }),
  updateVehicleMedia: vi.fn().mockResolvedValue(undefined),
  deleteVehicleMedia: vi.fn().mockResolvedValue(undefined),
  setMainVehicleMedia: vi.fn().mockResolvedValue(undefined),
  getPublishedPurchaseRecords: vi.fn().mockResolvedValue([]),
  getAllPurchaseRecords: vi.fn().mockResolvedValue([]),
  getPurchaseRecordById: vi.fn().mockResolvedValue(undefined),
  createPurchaseRecord: vi.fn().mockResolvedValue({ insertId: 1 }),
  updatePurchaseRecord: vi.fn().mockResolvedValue(undefined),
  deletePurchaseRecord: vi.fn().mockResolvedValue(undefined),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("vehicles.list", () => {
  it("returns published vehicles for public access", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vehicles.list();

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("TOYOTA LAND CRUISER PRADO");
  });
});

describe("vehicles.listAll", () => {
  it("returns all vehicles for admin users", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vehicles.listAll();

    expect(result).toHaveLength(2);
  });

  it("throws FORBIDDEN for non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.vehicles.listAll()).rejects.toThrow("管理者権限が必要です");
  });

  it("throws UNAUTHORIZED for unauthenticated users", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.vehicles.listAll()).rejects.toThrow();
  });
});

describe("vehicles.get", () => {
  it("returns a vehicle by id", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vehicles.get({ id: 1 });

    expect(result.title).toBe("TOYOTA LAND CRUISER PRADO");
  });

  it("throws NOT_FOUND for non-existent vehicle", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.vehicles.get({ id: 999 })).rejects.toThrow("在庫が見つかりません");
  });
});

describe("vehicles.create", () => {
  it("creates a vehicle for admin users", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vehicles.create({
      title: "New Vehicle",
      priceDisplay: "1,000,000",
      description: "Test description",
      status: "在庫あり",
      isPublished: true,
    });

    expect(result.success).toBe(true);
  });

  it("throws FORBIDDEN for non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.vehicles.create({
        title: "New Vehicle",
      })
    ).rejects.toThrow("管理者権限が必要です");
  });
});

describe("vehicles.delete", () => {
  it("deletes a vehicle for admin users", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.vehicles.delete({ id: 1 });

    expect(result.success).toBe(true);
  });

  it("throws FORBIDDEN for non-admin users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.vehicles.delete({ id: 1 })).rejects.toThrow("管理者権限が必要です");
  });
});
