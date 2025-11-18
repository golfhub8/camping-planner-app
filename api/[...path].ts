import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverless from 'serverless-http';
import { app } from '../server/index';

const handler = serverless(app);

export default async function (req: VercelRequest, res: VercelResponse) {
  // Vercel catch-all function wrapper for Express
  // This will handle all /api/* routes
  return handler(req as any, res as any);
}
