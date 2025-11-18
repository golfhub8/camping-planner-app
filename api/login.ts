// api/login.ts
// Temporary test route to confirm Vercel API routing

export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    res.status(200).json({
      ok: true,
      message: "GET /api/login is reachable from Vercel"
    });
    return;
  }

  res.status(405).json({
    ok: false,
    error: "Only GET supported on this temporary test route"
  });
}
