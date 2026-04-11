import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { videoProxyHandler, videoProxyOptionsHandler } from "./videoProxy";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("videoProxy", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let resHeaders: Record<string, string>;
  let resStatus: number;
  let resBody: any;

  beforeEach(() => {
    resHeaders = {};
    resStatus = 200;
    resBody = null;
    
    mockReq = {
      query: {},
      headers: {},
    };
    
    mockRes = {
      status: vi.fn().mockImplementation((code: number) => {
        resStatus = code;
        return mockRes;
      }),
      setHeader: vi.fn().mockImplementation((key: string, value: string) => {
        resHeaders[key] = value;
        return mockRes;
      }),
      json: vi.fn().mockImplementation((body: any) => {
        resBody = body;
        return mockRes;
      }),
      end: vi.fn(),
      write: vi.fn(),
      headersSent: false,
      writableEnded: false,
    };

    mockFetch.mockReset();
  });

  describe("videoProxyOptionsHandler", () => {
    it("should return CORS headers for OPTIONS request", () => {
      videoProxyOptionsHandler(mockReq as Request, mockRes as Response);

      expect(mockRes.setHeader).toHaveBeenCalledWith("Access-Control-Allow-Origin", "*");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Access-Control-Allow-Headers", "Range");
      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe("videoProxyHandler", () => {
    it("should return 400 if url parameter is missing", async () => {
      mockReq.query = {};

      await videoProxyHandler(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Missing url parameter" });
    });

    it("should return 403 if url is not allowed", async () => {
      mockReq.query = { url: "https://evil.com/video.mp4" };

      await videoProxyHandler(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "URL not allowed" });
    });

    it("should allow CloudFront URLs", async () => {
      const testUrl = "https://d2xsxph8kpxj0f.cloudfront.net/test/video.mp4";
      mockReq.query = { url: testUrl };
      mockReq.headers = {};

      const mockBody = {
        getReader: () => ({
          read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
          cancel: vi.fn(),
        }),
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([
          ["content-type", "video/mp4"],
          ["content-length", "1000"],
        ]),
        body: mockBody,
      });

      await videoProxyHandler(mockReq as Request, mockRes as Response);

      expect(mockFetch).toHaveBeenCalledWith(testUrl, expect.any(Object));
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "video/mp4");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Accept-Ranges", "bytes");
    });

    it("should forward Range header to upstream", async () => {
      const testUrl = "https://d2xsxph8kpxj0f.cloudfront.net/test/video.mp4";
      mockReq.query = { url: testUrl };
      mockReq.headers = { range: "bytes=0-1023" };

      const mockBody = {
        getReader: () => ({
          read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
          cancel: vi.fn(),
        }),
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 206,
        statusText: "Partial Content",
        headers: new Map([
          ["content-type", "video/mp4"],
          ["content-length", "1024"],
          ["content-range", "bytes 0-1023/30000000"],
        ]),
        body: mockBody,
      });

      await videoProxyHandler(mockReq as Request, mockRes as Response);

      expect(mockFetch).toHaveBeenCalledWith(testUrl, {
        method: "GET",
        headers: { Range: "bytes=0-1023" },
      });
      expect(mockRes.status).toHaveBeenCalledWith(206);
    });

    it("should set CORS headers on response", async () => {
      const testUrl = "https://d2xsxph8kpxj0f.cloudfront.net/test/video.mp4";
      mockReq.query = { url: testUrl };
      mockReq.headers = {};

      const mockBody = {
        getReader: () => ({
          read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
          cancel: vi.fn(),
        }),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([
          ["content-type", "video/mp4"],
        ]),
        body: mockBody,
      });

      await videoProxyHandler(mockReq as Request, mockRes as Response);

      expect(mockRes.setHeader).toHaveBeenCalledWith("Access-Control-Allow-Origin", "*");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    });

    it("should allow S3 URLs", async () => {
      const testUrl = "https://manus-storage-prod-sg.s3.ap-southeast-1.amazonaws.com/test/video.mp4";
      mockReq.query = { url: testUrl };
      mockReq.headers = {};

      const mockBody = {
        getReader: () => ({
          read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
          cancel: vi.fn(),
        }),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Map([
          ["content-type", "video/mp4"],
          ["content-length", "5000"],
        ]),
        body: mockBody,
      });

      await videoProxyHandler(mockReq as Request, mockRes as Response);

      expect(mockFetch).toHaveBeenCalledWith(testUrl, expect.any(Object));
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "video/mp4");
    });

    it("should handle upstream errors", async () => {
      const testUrl = "https://d2xsxph8kpxj0f.cloudfront.net/test/video.mp4";
      mockReq.query = { url: testUrl };
      mockReq.headers = {};

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Map(),
      });

      await videoProxyHandler(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("Upstream error") })
      );
    });

    it("should handle fetch exceptions", async () => {
      const testUrl = "https://d2xsxph8kpxj0f.cloudfront.net/test/video.mp4";
      mockReq.query = { url: testUrl };
      mockReq.headers = {};

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await videoProxyHandler(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Proxy error" });
    });
  });
});
