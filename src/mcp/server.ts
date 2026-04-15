/**
 * MCP server for the Krafter Resume Toolkit.
 *
 * Creates a Model Context Protocol server exposing resume scoring tools
 * over stdio transport. The server registers all scoring tools at startup
 * and is designed to be extended with additional tool categories (e.g.
 * Krafter integration tools) in future tasks.
 *
 * Usage:
 *   import { startServer } from './server.js';
 *   await startServer();
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getScoringTools } from './tools/scoring.js';

/**
 * Create and configure the MCP server with all available tools.
 *
 * Scoring tools (score_resume, score_ats) are always registered.
 * Additional tool categories (e.g. Krafter tools) will be registered
 * conditionally in future tasks.
 *
 * @returns A configured {@link McpServer} instance ready to connect.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'krafter-toolkit',
    version: '1.0.0',
  });

  // Register scoring tools (always available).
  // Uses the non-deprecated registerTool API which accepts a config object
  // with an inputSchema (a Zod shape or full schema).
  for (const tool of getScoringTools()) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema.shape,
      },
      async (args: Record<string, unknown>) => {
        return tool.handler(args);
      },
    );
  }

  // Krafter tools will be registered conditionally in Task 11

  return server;
}

/**
 * Start the MCP server with stdio transport.
 *
 * This connects the server to stdin/stdout for communication with
 * MCP clients (e.g. Claude Desktop, IDE extensions).
 */
export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
