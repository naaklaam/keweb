const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config();

const localtunnel = require('localtunnel');

const PORT = parseInt(process.env.PORT || '5000', 10);
const SUBDOMAIN =process.env.SUBDOMAIN || 'keweb';

async function startTunnel() {
  console.log(`[Tunnel Runner] Requesting fixed subdomain: https://${SUBDOMAIN}.loca.lt (Port: ${PORT})...`);

  let waitTimeMs = 10000;

  while (true) {
    try {
      const tunnel = await localtunnel({
        port: PORT,
        subdomain: SUBDOMAIN
      });

      const assignedUrl = tunnel.url;
      const expectedUrl = `https://${SUBDOMAIN.toLowerCase()}.loca.lt`;

      console.log(`[Tunnel Runner] Received URL from cloud server: ${assignedUrl}`);

      if (assignedUrl.toLowerCase() === expectedUrl.toLowerCase()) {
        console.log(`[✓] SUCCESS: Connected to requested subdomain https://${SUBDOMAIN}.loca.lt`);
        
        tunnel.on('close', () => {
          console.warn('[!] Localtunnel connection closed. Reconnecting in 5s...');
          setTimeout(startTunnel, 5000);
        });

        tunnel.on('error', (err) => {
          console.error('[!] Localtunnel error:', err.message);
          try { tunnel.close(); } catch (e) {}
        });

        // Reset backoff on success
        return;
      } else {
        console.warn(`[!] WARNING: Cloud server assigned fallback URL '${assignedUrl}' because '${SUBDOMAIN}' socket is temporarily locked on loca.lt.`);
        console.warn(`[!] Closing fallback socket and waiting ${Math.round(waitTimeMs / 1000)}s for '${SUBDOMAIN}' socket to clear...`);
        tunnel.close();
        await new Promise(r => setTimeout(r, waitTimeMs));
        // Exponential backoff up to 30s so loca.lt socket cooldown clears
        waitTimeMs = Math.min(30000, waitTimeMs + 5000);
      }
    } catch (err) {
      console.error(`[!] Error creating tunnel: ${err.message}. Retrying in 10s...`);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}

startTunnel();
