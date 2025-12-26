import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'test', version: '1.0.0' });

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/liurongtao/fiftyk/add-subtract-multiply-divide-dev/.data'],
  stderr: 'inherit',
});

await client.connect(transport);

const result = await client.listTools();
console.log('=== MCP Tools ===');
for (const tool of result.tools) {
  console.log('\nTool:', tool.name);
  console.log('  description:', tool.description);
  console.log('  inputSchema:', JSON.stringify(tool.inputSchema, null, 2));
  console.log('  outputSchema:', JSON.stringify(tool.outputSchema, null, 2));
}

await transport.close();
