# ✅ Correct Vercel Configuration

## The Issue
Your monorepo has:
- Dependencies at ROOT (node_modules/)
- Client code in client/
- Vercel can't find deps when Root Directory = client

## The Solution

### 1. vercel.json (at project root)
Uses Vercel v2 API with @vercel/static-build:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "client/dist"
      }
    }
  ]
}
```

### 2. Add vercel-build script to ROOT package.json
You need to manually add this to your root package.json:
```json
"scripts": {
  "vercel-build": "cd client && npm run vercel-build"
}
```

### 3. Vercel Dashboard Settings
| Setting | Value |
|---------|-------|
| **Framework Preset** | Other |
| **Root Directory** | (LEAVE EMPTY) |
| **Build Command** | (leave default) |
| **Output Directory** | (leave default) |

## How It Works
1. Vercel runs from project root
2. Finds package.json at root
3. Runs `npm run vercel-build` (which you add manually)
4. That script does: `cd client && npm run vercel-build`
5. Vite builds to client/dist/
6. Vercel deploys client/dist/

## Manual Steps Required
Since I can't edit root package.json, you need to:

1. Open package.json (at project root)
2. Find the "scripts" section
3. Add this line:
   ```json
   "vercel-build": "cd client && npm run vercel-build",
   ```

