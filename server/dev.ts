import { app } from './index.js';
import { setupVite, log } from './vite.js';
import { createServer } from 'http';

const PORT = process.env.PORT || 3000;

(async () => {
  const server = createServer(app);
  await setupVite(app, server);
  
  server.listen(PORT, () => {
    log(`Development server running on port ${PORT}`);
  });
})();
