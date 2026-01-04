/**
 * Interactive Session Demo with User Input
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:3001';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log('🔌 Connecting to WebSocket server...\n');

  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('✅ Connected!\n');
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('📨 Received:', msg.type.toUpperCase());

    if (msg.type === 'error') {
      console.log('   Error:', msg.error);
    } else if (msg.type === 'session_created') {
      console.log('   Session ID:', msg.sessionId);
      console.log('   Steps:', msg.steps.length);
    } else if (msg.type === 'plan_received') {
      console.log('   Plan ID:', msg.data?.plan?.id);
    } else if (msg.type === 'awaiting_input') {
      console.log('   Prompt:', msg.data?.prompt);
      console.log('   Waiting for user input...\n');
    } else if (msg.type === 'completed') {
      console.log('   Final Result:', JSON.stringify(msg.data?.result?.finalResult, null, 2));
    }
    console.log('');
  });

  ws.on('error', (error) => {
    console.error('❌ Error:', error.message);
  });

  // Wait for connection
  await new Promise(resolve => {
    ws.on('open', resolve);
  });
  await sleep(500);

  // Step 1: Create session
  console.log('=== Step 1: Create Interactive Session ===');
  ws.send(JSON.stringify({
    type: 'start',
    planId: 'plan-a1a8aa92'  // Use existing plan
  }));

  await sleep(2000);

  // Step 2: Confirm execution
  console.log('=== Step 2: Confirm Execution ===');
  ws.send(JSON.stringify({
    type: 'confirm',
    sessionId: 'session-8764092d',
    value: true
  }));

  await sleep(5000);

  // Step 3: Send first input
  console.log('=== Step 3: Send First Input (10) ===');
  ws.send(JSON.stringify({
    type: 'input',
    sessionId: 'session-8764092d',
    value: { firstNumber: 10 }
  }));

  await sleep(2000);

  // Step 4: Send second input
  console.log('=== Step 4: Send Second Input (3) ===');
  ws.send(JSON.stringify({
    type: 'input',
    sessionId: 'session-8764092d',
    value: { secondNumber: 3 }
  }));

  await sleep(3000);

  console.log('=== Demo Complete ===\n');

  ws.close();
  process.exit(0);
}

runDemo().catch(console.error);
