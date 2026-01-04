import dgram from 'dgram';
import os from 'os';

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    const ifaces = interfaces[name] ?? []

    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  return 'localhost';
}

export function setupDiscoveryServer() {
  const udpServer = dgram.createSocket('udp4');
  const PORT = Number(process.env.PORT) || 3000;
  const DISCOVERY_PORT = Number(process.env.DISCOVERY_PORT) || 8888;

  udpServer.on('message', (msg, rinfo) => {
    const message = msg.toString();
    
    if (message === 'ANIME_API_DISCOVERY') {
      const localIp = getLocalIpAddress();
      const response = JSON.stringify({
        service: 'anime-api',
        host: localIp,
        port: PORT,
        version: '1.0.0',
        endpoints: {
          anime: '/anime',
          meta: '/meta'
        },
        timestamp: Date.now()
      });
      
      udpServer.send(response, rinfo.port, rinfo.address, (error) => {
        if (error) {
          console.error('Discovery response error:', error);
        } else {
          console.log(`Discovery response sent to ${rinfo.address}`);
        }
      });
    }
  });

  udpServer.on('error', (err) => {
    console.error('Discovery server error:', err);
  });

  udpServer.bind(DISCOVERY_PORT, '0.0.0.0', () => {
    console.log(`🔍 Discovery server listening on port ${DISCOVERY_PORT}`);
  });

  return udpServer;
}
