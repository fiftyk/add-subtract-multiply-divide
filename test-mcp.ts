/**
 * 测试 MCP 远程函数调用
 */

import { MCPClient } from './dist/src/mcp/MCPClient.js';

async function main() {
  console.log('🔌 连接到 MCP Server...\n');

  const client = new MCPClient({
    name: 'filesystem-test',
    transportType: 'stdio',
    transportConfig: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp/test_mcp_dir'],
    },
  });

  try {
    await client.connect();
    console.log('✅ 已连接到 MCP Server\n');

    // 列出可用工具
    const tools = await client.list();
    console.log(`📦 发现 ${tools.length} 个工具:`);
    for (const tool of tools) {
      console.log(`  - ${tool.name}: ${tool.description}`);
    }
    console.log();

    // 调用 list_files 工具
    console.log('📂 调用 list_files 工具...\n');
    const result = await client.execute('list_files', { path: '/tmp/test_mcp_dir' });

    if (result.success) {
      console.log('✅ 结果:', JSON.stringify(result.content, null, 2));
    } else {
      console.log('❌ 错误:', result.error);
    }

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await client.disconnect();
    console.log('\n🔌 已断开连接');
  }
}

main();
