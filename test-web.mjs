// Simple test script to verify web server can start
import { startWebServer } from './src/web/server.js';

console.log('Starting web server...');
await startWebServer(3005);
console.log('Server started');
