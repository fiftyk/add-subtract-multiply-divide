/**
 * WebSocket Interactive Session Test
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3001';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  console.log('🔌 Connecting to WebSocket server...\n');

  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('✅ Connected!\n');
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Received:', JSON.stringify(message, null, 2));
    console.log('');
  });

  ws.on('error', (error) => {
    console.error('❌ Error:', error.message);
  });

  ws.on('close', () => {
    console.log('🔌 Disconnected');
  });

  // Wait for connection
  await new Promise(resolve => {
    ws.on('open', resolve);
  });

  // Wait a bit for any welcome message
  await sleep(500);

  // Test 1: Create session
  console.log('=== Test 1: Create Session ===');
  ws.send(JSON.stringify({
    type: 'start',
    request: '列出当前目录的所有文件'
  }));

  await sleep(2000);

  // Test 2: Confirm execution
  console.log('=== Test 2: Confirm Execution ===');
  ws.send(JSON.stringify({
    type: 'confirm',
    sessionId: 'session-fccb87b1',
    value: true
  }));

  await sleep(3000);

  // Test 3: List sessions via REST API
  console.log('=== Test 3: Check Session via REST API ===');
  const response = await fetch('http://localhost:3000/api/interactive/sessions/session-fccb87b1');
  const data = await response.json();
  console.log('Session Status:', data.data.status);

  console.log('\n=== Test Complete ===');

  ws.close();
  process.exit(0);
}

runTest().catch(console.error);
