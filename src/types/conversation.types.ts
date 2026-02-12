export interface Conversation {
  id: string;
  title: string;
  userId: string;
  messages: ConversationMessage[];
  metadata: {
    provider: string;
    model: string;
    systemPrompt?: string;
    createdAt: Date;
    updatedAt: Date;
    lastMessageAt: Date;
    messageCount: number;
    totalTokens: number;
    totalCost: number;
    tags: string[];
    category: string;
    isPinned: boolean;
    isArchived: boolean;
    isShared: boolean;
    shareId?: string;
    shareExpiry?: Date;
  };
  settings: ConversationSettings;
  analytics: ConversationAnalytics;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata: {
    provider?: string;
    model?: string;
    tokens?: number;
    latency?: number;
    cost?: number;
    context?: any;
    edited?: boolean;
    editedAt?: Date;
    deleted?: boolean;
    deletedAt?: Date;
  };
  reactions: MessageReaction[];
  attachments: MessageAttachment[];
  embeddings?: number[];
}

export interface ConversationSettings {
  temperature: number;
  maxTokens: number;
  streamResponse: boolean;
  includeContext: boolean;
  contextSources: string[];
  autoSave: boolean;
  shareEnabled: boolean;
  notifications: boolean;
  language: string;
  theme: 'light' | 'dark' | 'auto';
}

export interface ConversationAnalytics {
  views: number;
  shares: number;
  exports: number;
  averageSessionDuration: number;
  userSatisfaction: number;
  responseQuality: number;
  tokenEfficiency: number;
  costEfficiency: number;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  timestamp: Date;
}

export interface MessageAttachment {
  id: string;
  messageId: string;
  type: 'image' | 'file' | 'code' | 'link' | 'audio' | 'video';
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
  metadata?: any;
  thumbnail?: string;
}

export interface ConversationSearch {
  query: string;
  filters: {
    dateRange?: {
      start: Date;
      end: Date;
    };
    providers?: string[];
    models?: string[];
    tags?: string[];
    categories?: string[];
    hasAttachments?: boolean;
    isShared?: boolean;
    isPinned?: boolean;
    isArchived?: boolean;
  };
  sorting: {
    field: 'createdAt' | 'updatedAt' | 'lastMessageAt' | 'messageCount' | 'totalCost';
    order: 'asc' | 'desc';
  };
  pagination: {
    page: number;
    limit: number;
    offset: number;
  };
}

export interface ConversationSearchResult {
  conversations: Conversation[];
  total: number;
  facets: {
    providers: Array<{ name: string; count: number }>;
    models: Array<{ name: string; count: number }>;
    tags: Array<{ name: string; count: number }>;
    categories: Array<{ name: string; count: number }>;
  };
  suggestions: string[];
}

export interface ConversationShare {
  id: string;
  conversationId: string;
  shareId: string;
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
  permissions: {
    canView: boolean;
    canComment: boolean;
    canShare: boolean;
    canDownload: boolean;
  };
  settings: {
    includeMetadata: boolean;
    includeAnalytics: boolean;
    watermark: boolean;
    password?: string;
  };
  analytics: {
    views: number;
    downloads: number;
    comments: number;
    lastViewed?: Date;
  };
}

export interface ConversationExport {
  id: string;
  conversationId: string;
  format: 'json' | 'markdown' | 'pdf' | 'html' | 'csv';
  options: {
    includeMetadata: boolean;
    includeAnalytics: boolean;
    includeAttachments: boolean;
    compressImages: boolean;
    customTemplate?: string;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: Date;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}
