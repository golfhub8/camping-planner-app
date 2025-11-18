import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { stripeWebhookRouter, setWebhookStorage } from "./webhooks/stripeWebhook";
import { storage } from "./storage";

const app = express();

// IMPORTANT: Mount Stripe webhook router BEFORE global JSON middleware
// The webhook needs raw body for signature verification
setWebhookStorage(storage);
app.use("/api/stripe", stripeWebhookRouter);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Configure CORS to allow only specific origins
const isDevelopment = app.get("env") === "development";
const allowedOrigins = [
  'https://app.thecampingplanner.app',
  'http://localhost:5173',
  'http://localhost:5000',
];

app.use(cors({
  origin: (origin, callback) => {
    // In development, allow all origins for easier testing
    if (isDevelopment) {
      return callback(null, true);
    }

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Check exact matches
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Check wildcard pattern for Vercel deployments: https://*.vercel.app
    // Use proper URL parsing to prevent spoofing (e.g., https://foo.vercel.app.evil.com)
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      
      // Verify hostname ends with .vercel.app and has exactly 3 parts (subdomain.vercel.app)
      if (hostname.endsWith('.vercel.app')) {
        const parts = hostname.split('.');
        // Should be exactly 3 parts: [subdomain, 'vercel', 'app']
        if (parts.length === 3 && parts[1] === 'vercel' && parts[2] === 'app') {
          return callback(null, true);
        }
      }
    } catch (error) {
      // Invalid URL, reject
      return callback(new Error('Not allowed by CORS'));
    }

    // Origin not allowed
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Initialize routes and error handling
let routesInitialized = false;
let initializationPromise: Promise<void> | null = null;

async function initializeApp() {
  if (routesInitialized) {
    return;
  }
  
  if (initializationPromise) {
    return initializationPromise;
  }
  
  initializationPromise = (async () => {
    await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });
    
    routesInitialized = true;
  })();
  
  return initializationPromise;
}

// Initialize routes and middleware (wrapped in IIFE for top-level await)
(async () => {
  await initializeApp();

  // Only start the server if not running in Vercel serverless environment
  if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      // In development, we need to create server first for Vite HMR
      const { createServer } = await import("http");
      const server = createServer(app);
      await setupVite(app, server);
      server.listen(PORT, () => {
        log(`serving on port ${PORT}`);
      });
    } else {
      serveStatic(app);
      app.listen(PORT, () => {
        log(`serving on port ${PORT}`);
      });
    }
  }
})();

// Export the app and initialization function for Vercel serverless functions
export { app, initializeApp };
