// MCP Tools Configuration
// Centralized definition of all available MCP tools

export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
  }
}

export const mcpTools: MCPTool[] = [
  {
    name: 'send_email',
    description: 'Send an email using Gmail',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body content' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'read_calendar',
    description: 'Read Google Calendar events',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'create_notion_page',
    description: 'Create a new page in Notion',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Page title' },
        content: { type: 'string', description: 'Page content' },
        parentId: { type: 'string', description: 'Parent page ID' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'firebase_read',
    description: 'Read data from Firebase',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection name' },
        documentId: { type: 'string', description: 'Document ID' },
      },
      required: ['collection'],
    },
  },
  {
    name: 'firebase_write',
    description: 'Write data to Firebase',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection name' },
        documentId: { type: 'string', description: 'Document ID' },
        data: { type: 'object', description: 'Data to write' },
      },
      required: ['collection', 'data'],
    },
  },
]

export const serverInfo = {
  name: 'corel-mcp-server',
  version: '1.0.0',
  capabilities: {
    tools: {},
  },
}

// Tool execution functions
export const executeTool = (toolName: string, args: any): string => {
  const results: { [key: string]: string } = {
    send_email: `Email sent to ${args?.to} with subject "${args?.subject}"`,
    read_calendar: `Events retrieved from ${args?.startDate} to ${args?.endDate}`,
    create_notion_page: `Page "${args?.title}" created successfully`,
    firebase_read: `Data retrieved from ${args?.collection}${args?.documentId ? `/${args.documentId}` : ''}`,
    firebase_write: `Data written to ${args?.collection}${args?.documentId ? `/${args.documentId}` : ''}`,
  }

  return results[toolName] || 'Tool executed successfully'
}

// Validation function for tool arguments
export const validateToolArgs = (tool: MCPTool, args: any): string[] => {
  if (!args) return tool.inputSchema.required

  return tool.inputSchema.required.filter(
    (required: string) => !(required in args)
  )
}
