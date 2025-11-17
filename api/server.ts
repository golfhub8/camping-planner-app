import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverless from 'serverless-http';
import { app } from '../server/index.js';

const handler = serverless(app);

export default async function (req: VercelRequest, res: VercelResponse) {
  // Vercel Node function wrapper for Express
  return handler(req as any, res as any);
}
