export interface IPlugin {
  name: string;
  version: string;
  description: string;

  initialize(context: PluginContext): Promise<void>;
  execute(input: PluginInput): Promise<PluginOutput>;
  cleanup(): Promise<void>;
}

export interface PluginContext {
  config: Record<string, any>;
  services: {
    llm?: any;
    storage?: any;
    api?: any;
  };
}

export interface PluginInput {
  type: string;
  data: any;
  metadata?: Record<string, any>;
}

export interface PluginOutput {
  success: boolean;
  data?: any;
  error?: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  dependencies?: Record<string, string>;
  permissions?: string[];
  entryPoint: string;
}
