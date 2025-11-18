import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverless from 'serverless-http';
import { app, initializeApp } from '../server/index';

let handler: any = null;

export default async function (req: VercelRequest, res: VercelResponse) {
  // Ensure routes are initialized before handling any requests
  await initializeApp();
  
  // Create handler lazily after initialization
  if (!handler) {
    handler = serverless(app);
  }
  
  // Handle the request with the initialized Express app
  return handler(req as any, res as any);
}
