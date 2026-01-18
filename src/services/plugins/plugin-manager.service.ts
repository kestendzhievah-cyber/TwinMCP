import { IPlugin, PluginContext, PluginInput, PluginOutput, PluginManifest } from '../../plugins/plugin.interface';
import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';

export class PluginManager {
  private plugins: Map<string, IPlugin>;
  private pluginDir: string;

  constructor(private db: Pool) {
    this.plugins = new Map();
    this.pluginDir = process.env.PLUGIN_DIR || path.join(process.cwd(), 'plugins');
  }

  async loadPlugin(pluginPath: string): Promise<void> {
    const manifestPath = path.join(pluginPath, 'manifest.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest: PluginManifest = JSON.parse(manifestContent);

    const entryPath = path.join(pluginPath, manifest.entryPoint);
    const plugin = await import(entryPath);
    const instance: IPlugin = new plugin.default();

    await instance.initialize(this.createContext());
    this.plugins.set(instance.name, instance);

    await this.registerPlugin(instance, manifest);
  }

  async executePlugin(
    pluginName: string,
    input: PluginInput
  ): Promise<PluginOutput> {
    const plugin = this.plugins.get(pluginName);

    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    return await plugin.execute(input);
  }

  async installPlugin(packageName: string): Promise<void> {
    const pluginPath = path.join(this.pluginDir, packageName);

    await this.verifyPlugin(pluginPath);
    await this.installDependencies(pluginPath);
    await this.loadPlugin(pluginPath);
  }

  async uninstallPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);

    if (plugin) {
      await plugin.cleanup();
      this.plugins.delete(pluginName);
    }

    await this.db.query(
      'DELETE FROM plugins WHERE name = $1',
      [pluginName]
    );
  }

  async listPlugins(): Promise<IPlugin[]> {
    return Array.from(this.plugins.values());
  }

  async getPlugin(name: string): Promise<IPlugin | undefined> {
    return this.plugins.get(name);
  }

  private createContext(): PluginContext {
    return {
      config: {},
      services: {
        llm: null,
        storage: null,
        api: null
      }
    };
  }

  private async verifyPlugin(pluginPath: string): Promise<void> {
    const manifestPath = path.join(pluginPath, 'manifest.json');
    
    try {
      await fs.access(manifestPath);
    } catch {
      throw new Error('Invalid plugin: manifest.json not found');
    }
  }

  private async installDependencies(pluginPath: string): Promise<void> {
    const packageJsonPath = path.join(pluginPath, 'package.json');
    
    try {
      await fs.access(packageJsonPath);
    } catch {
      return;
    }
  }

  private async registerPlugin(plugin: IPlugin, manifest: PluginManifest): Promise<void> {
    await this.db.query(
      `INSERT INTO plugins (name, version, description, manifest, installed_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (name) DO UPDATE SET
         version = $2,
         description = $3,
         manifest = $4,
         updated_at = NOW()`,
      [plugin.name, plugin.version, plugin.description, JSON.stringify(manifest)]
    );
  }
}
