import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

// ★ CJS互換: esbuild CJS出力では import.meta.url が undefined → __dirname フォールバック
const _filename = typeof import.meta?.url === "string"
  ? fileURLToPath(import.meta.url)
  : typeof __filename === "string" ? __filename : "";
const _dirname = path.dirname(_filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(_dirname, "public")
      : path.resolve(_dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}

startServer().catch(console.error);
