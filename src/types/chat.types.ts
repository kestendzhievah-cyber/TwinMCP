export interface ChatMessage {
  id: string;
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
    error?: string;
  };
  status: 'sending' | 'streaming' | 'completed' | 'error';
  reactions?: MessageReaction[];
  attachments?: MessageAttachment[];
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  metadata: {
    userId: string;
    provider: string;
    model: string;
    systemPrompt?: string;
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
    totalTokens: number;
    totalCost: number;
  };
  settings: ConversationSettings;
}

export interface ConversationSettings {
  temperature: number;
  maxTokens: number;
  streamResponse: boolean;
  includeContext: boolean;
  contextSources: string[];
  autoSave: boolean;
  shareEnabled: boolean;
}

export interface ChatState {
  conversations: ChatConversation[];
  activeConversation: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  settings: ChatSettings;
}

export interface ChatSettings {
  defaultProvider: string;
  defaultModel: string;
  theme: 'light' | 'dark' | 'auto';
  fontSize: 'small' | 'medium' | 'large';
  soundEnabled: boolean;
  notifications: boolean;
  autoSave: boolean;
}

export interface MessageReaction {
  id: string;
  emoji: string;
  userId: string;
  timestamp: Date;
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'file' | 'code' | 'link';
  name: string;
  url: string;
  size?: number;
  metadata?: any;
}

export interface ChatProvider {
  id: string;
  name: string;
  models: ChatModel[];
  apiKey?: string;
  endpoint?: string;
}

export interface ChatModel {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
  costPerToken: number;
  supportsStreaming: boolean;
}

export interface StreamingChunk {
  content: string;
  metadata?: {
    tokens?: number;
    latency?: number;
    model?: string;
  };
  done?: boolean;
  error?: string;
}

export interface ChatAnalytics {
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  averageLatency: number;
  errorRate: number;
  conversationsPerDay: number;
}

export interface ChatError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}
