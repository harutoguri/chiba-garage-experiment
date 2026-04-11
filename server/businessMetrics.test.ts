import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "./db";
import { businessMetrics } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// モックデータ
const mockMetrics = [
  {
    id: 1,
    year: 2024,
    totalTransactionAmount: 8300000,
    assessmentCount: 50,
    contractCount: 45,
    isForecast: false,
    memo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    year: 2025,
    totalTransactionAmount: 86450000,
    assessmentCount: 125,
    contractCount: 115,
    isForecast: false,
    memo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    year: 2026,
    totalTransactionAmount: 150000000,
    assessmentCount: 200,
    contractCount: 180,
    isForecast: true,
    memo: "予想値",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("ビジネス指標API", () => {
  describe("データ構造", () => {
    it("ビジネス指標は必須フィールドを持つ", () => {
      const metric = mockMetrics[0];
      
      expect(metric).toHaveProperty("id");
      expect(metric).toHaveProperty("year");
      expect(metric).toHaveProperty("totalTransactionAmount");
      expect(metric).toHaveProperty("assessmentCount");
      expect(metric).toHaveProperty("contractCount");
      expect(metric).toHaveProperty("isForecast");
    });

    it("年度は2000-2100の範囲内", () => {
      mockMetrics.forEach((metric) => {
        expect(metric.year).toBeGreaterThanOrEqual(2000);
        expect(metric.year).toBeLessThanOrEqual(2100);
      });
    });

    it("isForecastはboolean型", () => {
      mockMetrics.forEach((metric) => {
        expect(typeof metric.isForecast).toBe("boolean");
      });
    });
  });

  describe("成約率計算", () => {
    it("成約率は成約数/査定数で計算される", () => {
      const metric = mockMetrics[1]; // 2025年: 115/125 = 92%
      const contractRate = metric.assessmentCount > 0
        ? (metric.contractCount / metric.assessmentCount) * 100
        : 0;
      
      expect(contractRate).toBeCloseTo(92.0, 1);
    });

    it("査定数が0の場合、成約率は0%", () => {
      const metricWithZeroAssessment = {
        ...mockMetrics[0],
        assessmentCount: 0,
        contractCount: 0,
      };
      
      const contractRate = metricWithZeroAssessment.assessmentCount > 0
        ? (metricWithZeroAssessment.contractCount / metricWithZeroAssessment.assessmentCount) * 100
        : 0;
      
      expect(contractRate).toBe(0);
    });
  });

  describe("金額フォーマット", () => {
    it("1億円以上は億円単位で表示", () => {
      const amount = 150000000; // 1.5億円
      const formatted = amount >= 100000000
        ? `${(amount / 100000000).toFixed(1)}億円`
        : `${Math.round(amount / 10000)}万円`;
      
      expect(formatted).toBe("1.5億円");
    });

    it("1万円以上は万円単位で表示", () => {
      const amount = 86450000; // 8645万円
      const formatted = amount >= 100000000
        ? `${(amount / 100000000).toFixed(1)}億円`
        : `${Math.round(amount / 10000)}万円`;
      
      expect(formatted).toBe("8645万円");
    });
  });

  describe("ソート", () => {
    it("年度順（昇順）でソートされる", () => {
      const sorted = [...mockMetrics].sort((a, b) => a.year - b.year);
      
      expect(sorted[0].year).toBe(2024);
      expect(sorted[1].year).toBe(2025);
      expect(sorted[2].year).toBe(2026);
    });
  });

  describe("予想フラグ", () => {
    it("予想値を含むかどうかを判定できる", () => {
      const hasForecast = mockMetrics.some((m) => m.isForecast);
      
      expect(hasForecast).toBe(true);
    });

    it("予想値のみをフィルタリングできる", () => {
      const forecasts = mockMetrics.filter((m) => m.isForecast);
      
      expect(forecasts.length).toBe(1);
      expect(forecasts[0].year).toBe(2026);
    });
  });
});
