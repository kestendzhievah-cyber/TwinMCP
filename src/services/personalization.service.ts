// src/services/personalization.service.ts
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import crypto from 'crypto';
import { 
  UserPreferences, 
  Theme, 
  ThemePreferences,
  LayoutPreferences,
  ChatPreferences,
  NotificationPreferences,
  AccessibilityPreferences,
  PrivacyPreferences,
  PerformancePreferences,
  ShortcutPreferences,
  PersonalizationAnalytics,
  ThemeExport,
  PreferencesExport,
  ThemeValidationError
} from '../types/personalization.types';

export class PersonalizationService {
  private themeCache: Map<string, Theme> = new Map();
  private defaultThemes: Theme[] = [];

  constructor(
    private db: Pool,
    private redis: Redis
  ) {
    this.initializeDefaultThemes();
  }

  async getUserPreferences(userId: string): Promise<UserPreferences> {
    // Vérification du cache
    const cached = await this.redis.get(`user_preferences:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Récupération en base
    const result = await this.db.query(
      'SELECT preferences FROM user_preferences WHERE user_id = $1',
      [userId]
    );

    let preferences: UserPreferences;
    
    if (result.rows.length === 0) {
      // Création des préférences par défaut
      preferences = this.createDefaultPreferences(userId);
      await this.saveUserPreferences(preferences);
    } else {
      preferences = JSON.parse(result.rows[0].preferences);
    }

    // Mise en cache
    await this.redis.setex(`user_preferences:${userId}`, 3600, JSON.stringify(preferences));

    return preferences;
  }

  async updateUserPreferences(
    userId: string,
    updates: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const current = await this.getUserPreferences(userId);
    
    const updated: UserPreferences = {
      ...current,
      ...updates,
      userId: current.userId
    };

    await this.saveUserPreferences(updated);
    await this.redis.setex(`user_preferences:${userId}`, 3600, JSON.stringify(updated));

    // Analytics
    await this.logPreferenceUpdate(userId, updates);

    return updated;
  }

  async getTheme(themeId: string): Promise<Theme | null> {
    // Vérification du cache
    if (this.themeCache.has(themeId)) {
      return this.themeCache.get(themeId)!;
    }

    // Recherche dans les thèmes par défaut
    const defaultTheme = this.defaultThemes.find(t => t.id === themeId);
    if (defaultTheme) {
      this.themeCache.set(themeId, defaultTheme);
      return defaultTheme;
    }

    // Recherche en base
    const result = await this.db.query(
      'SELECT * FROM themes WHERE id = $1',
      [themeId]
    );

    if (result.rows.length === 0) return null;

    const theme = this.mapRowToTheme(result.rows[0]);
    this.themeCache.set(themeId, theme);

    return theme;
  }

  async getAllThemes(userId?: string): Promise<Theme[]> {
    const themes = [...this.defaultThemes];

    // Ajout des thèmes personnalisés de l'utilisateur
    if (userId) {
      const customThemes = await this.db.query(
        'SELECT * FROM themes WHERE created_by = $1 ORDER BY created_at DESC',
        [userId]
      );

      for (const row of customThemes.rows) {
        const theme = this.mapRowToTheme(row);
        themes.push(theme);
        this.themeCache.set(theme.id, theme);
      }
    }

    // Ajout des thèmes communautaires
    const communityThemes = await this.db.query(
      'SELECT * FROM themes WHERE category = $\'community\' ORDER BY created_at DESC LIMIT 50',
      []
    );

    for (const row of communityThemes.rows) {
      const theme = this.mapRowToTheme(row);
      themes.push(theme);
      this.themeCache.set(theme.id, theme);
    }

    return themes;
  }

  async createCustomTheme(
    userId: string,
    theme: Omit<Theme, 'id' | 'category'>
  ): Promise<Theme> {
    const themeId = crypto.randomUUID();
    
    const fullTheme: Theme = {
      ...theme,
      id: themeId,
      category: 'custom',
      custom: true
    };

    // Validation du thème
    const validationErrors = this.validateTheme(fullTheme);
    if (validationErrors.length > 0) {
      throw new Error(`Theme validation failed: ${validationErrors.map(e => e.message).join(', ')}`);
    }

    await this.db.query(`
      INSERT INTO themes (
        id, name, description, category, colors, typography,
        spacing, shadows, border_radius, animations, custom, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
    `, [
      themeId,
      theme.name,
      theme.description,
      'custom',
      JSON.stringify(theme.colors),
      JSON.stringify(theme.typography),
      JSON.stringify(theme.spacing),
      JSON.stringify(theme.shadows),
      JSON.stringify(theme.borderRadius),
      JSON.stringify(theme.animations),
      true,
      userId
    ]);

    this.themeCache.set(themeId, fullTheme);

    // Analytics
    await this.logThemeCreation(userId, themeId);

    return fullTheme;
  }

  async updateCustomTheme(
    userId: string,
    themeId: string,
    updates: Partial<Theme>
  ): Promise<Theme> {
    // Vérification que le thème appartient à l'utilisateur
    const existing = await this.db.query(
      'SELECT * FROM themes WHERE id = $1 AND created_by = $2',
      [themeId, userId]
    );

    if (existing.rows.length === 0) {
      throw new Error('Theme not found or access denied');
    }

    const currentTheme = this.mapRowToTheme(existing.rows[0]);
    const updatedTheme: Theme = {
      ...currentTheme,
      ...updates,
      id: themeId,
      category: 'custom'
    };

    // Validation
    const validationErrors = this.validateTheme(updatedTheme);
    if (validationErrors.length > 0) {
      throw new Error(`Theme validation failed: ${validationErrors.map(e => e.message).join(', ')}`);
    }

    await this.db.query(`
      UPDATE themes SET
        name = $2,
        description = $3,
        colors = $4,
        typography = $5,
        spacing = $6,
        shadows = $7,
        border_radius = $8,
        animations = $9,
        updated_at = NOW()
      WHERE id = $1
    `, [
      themeId,
      updatedTheme.name,
      updatedTheme.description,
      JSON.stringify(updatedTheme.colors),
      JSON.stringify(updatedTheme.typography),
      JSON.stringify(updatedTheme.spacing),
      JSON.stringify(updatedTheme.shadows),
      JSON.stringify(updatedTheme.borderRadius),
      JSON.stringify(updatedTheme.animations)
    ]);

    this.themeCache.set(themeId, updatedTheme);

    return updatedTheme;
  }

  async deleteCustomTheme(userId: string, themeId: string): Promise<void> {
    const result = await this.db.query(
      'DELETE FROM themes WHERE id = $1 AND created_by = $2',
      [themeId, userId]
    );

    if (result.rowCount === 0) {
      throw new Error('Theme not found or access denied');
    }

    this.themeCache.delete(themeId);

    // Analytics
    await this.logThemeDeletion(userId, themeId);
  }

  async applyTheme(userId: string, themeId: string): Promise<void> {
    const theme = await this.getTheme(themeId);
    if (!theme) {
      throw new Error(`Theme ${themeId} not found`);
    }

    await this.updateUserPreferences(userId, {
      theme: {
        mode: 'custom' as any,
        primaryColor: theme.colors.primary,
        accentColor: theme.colors.accent,
        backgroundColor: theme.colors.background,
        textColor: theme.colors.text,
        fontFamily: theme.typography.fontFamily,
        fontSize: 'md',
        borderRadius: 'md',
        animations: theme.animations.enabled,
        reducedMotion: false
      }
    });

    // Analytics
    await this.logThemeApplication(userId, themeId);
  }

  async exportPreferences(userId: string): Promise<string> {
    const preferences = await this.getUserPreferences(userId);
    
    const exportData: PreferencesExport = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      preferences: {
        theme: preferences.theme,
        layout: preferences.layout,
        chat: preferences.chat,
        notifications: preferences.notifications,
        accessibility: preferences.accessibility,
        shortcuts: preferences.shortcuts
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importPreferences(userId: string, data: string): Promise<UserPreferences> {
    try {
      const importData = JSON.parse(data) as PreferencesExport;
      
      if (importData.version !== '1.0') {
        throw new Error('Unsupported preferences version');
      }

      const updates = importData.preferences;
      const updated = await this.updateUserPreferences(userId, updates);

      // Analytics
      await this.logPreferenceImport(userId);

      return updated;
      
    } catch (error) {
      throw new Error(`Invalid preferences data: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'}`);
    }
  }

  async exportTheme(themeId: string): Promise<string> {
    const theme = await this.getTheme(themeId);
    if (!theme) {
      throw new Error(`Theme ${themeId} not found`);
    }

    const exportData: ThemeExport = {
      version: '1.0',
      theme,
      exportedAt: new Date().toISOString(),
      metadata: {
        name: theme.name,
        description: theme.description,
        category: theme.category
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importTheme(userId: string, data: string): Promise<Theme> {
    try {
      const importData = JSON.parse(data) as ThemeExport;
      
      if (importData.version !== '1.0') {
        throw new Error('Unsupported theme version');
      }

      const theme = importData.theme;
      return await this.createCustomTheme(userId, theme);
      
    } catch (error) {
      throw new Error(`Invalid theme data: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'}`);
    }
  }

  async getAnalytics(userId: string): Promise<PersonalizationAnalytics> {
    const result = await this.db.query(`
      SELECT 
        COUNT(CASE WHEN action_type = 'theme_change' THEN 1 END) as theme_changes,
        COUNT(CASE WHEN action_type = 'theme_created' THEN 1 END) as custom_themes_created,
        COUNT(CASE WHEN action_type = 'preference_update' THEN 1 END) as settings_updates,
        MAX(created_at) as last_active
      FROM personalization_analytics
      WHERE user_id = $1
    `, [userId]);

    const row = result.rows[0];

    // Récupération de l'utilisation des préférences
    const preferencesUsage = await this.getPreferencesUsage(userId);
    const themeUsage = await this.getThemeUsage(userId);

    return {
      userId,
      themeChanges: parseInt(row.theme_changes) || 0,
      customThemesCreated: parseInt(row.custom_themes_created) || 0,
      settingsUpdates: parseInt(row.settings_updates) || 0,
      lastActive: row.last_active ? new Date(row.last_active) : new Date(),
      preferencesUsage,
      themeUsage
    };
  }

  private createDefaultPreferences(userId: string): UserPreferences {
    return {
      userId,
      theme: {
        mode: 'auto',
        primaryColor: '#3b82f6',
        accentColor: '#10b981',
        backgroundColor: '#ffffff',
        textColor: '#1f2937',
        fontFamily: 'Inter',
        fontSize: 'md',
        borderRadius: 'md',
        animations: true,
        reducedMotion: false
      },
      layout: {
        sidebarPosition: 'left',
        sidebarWidth: 300,
        sidebarCollapsed: false,
        showConversationList: true,
        showModelSelector: true,
        showSettingsButton: true,
        messageLayout: 'bubble',
        inputPosition: 'bottom',
        showTimestamps: true,
        showAvatars: true,
        showReactions: true,
        compactMode: false
      },
      chat: {
        defaultProvider: 'openai',
        defaultModel: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 2048,
        streamResponse: true,
        autoSave: true,
        showContext: true,
        contextPosition: 'top',
        showTokenCount: true,
        showCost: true,
        showLatency: true,
        messageHistory: 50,
        autoScroll: true
      },
      notifications: {
        desktop: true,
        sound: true,
        email: false,
        types: {
          newMessage: true,
          responseComplete: true,
          error: true,
          systemUpdate: false,
          shareNotification: false
        },
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
          timezone: 'Europe/Paris'
        },
        frequency: 'important'
      },
      accessibility: {
        highContrast: false,
        largeText: false,
        screenReader: false,
        keyboardNavigation: true,
        focusVisible: true,
        reducedMotion: false,
        colorBlindFriendly: false,
        dyslexiaFont: false,
        lineSpacing: 'normal',
        wordSpacing: 'normal'
      },
      privacy: {
        shareAnalytics: true,
        shareConversations: false,
        saveHistory: true,
        encryptMessages: false,
        autoDelete: {
          enabled: false,
          days: 30
        },
        dataRetention: {
          conversations: 100,
          messages: 1000,
          files: 50
        },
        gdprCompliance: true
      },
      performance: {
        enableAnimations: true,
        enableTransitions: true,
        enableShadows: true,
        enableBlur: false,
        maxConversations: 50,
        maxMessagesPerConversation: 1000,
        cacheSize: 100,
        preloadContent: true,
        lazyLoading: true
      },
      shortcuts: {
        customShortcuts: {},
        enabledShortcuts: ['ctrl+enter', 'ctrl+k', 'ctrl+/'],
        modifierKey: 'ctrl',
        showHelp: true
      }
    };
  }

  private async saveUserPreferences(preferences: UserPreferences): Promise<void> {
    await this.db.query(`
      INSERT INTO user_preferences (user_id, preferences, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        preferences = EXCLUDED.preferences,
        updated_at = EXCLUDED.updated_at
    `, [preferences.userId, JSON.stringify(preferences)]);
  }

  private initializeDefaultThemes(): void {
    this.defaultThemes = [
      {
        id: 'light',
        name: 'Light',
        description: 'Thème clair par défaut',
        category: 'built-in',
        colors: {
          primary: '#3b82f6',
          secondary: '#6b7280',
          accent: '#10b981',
          background: '#ffffff',
          surface: '#f9fafb',
          text: '#1f2937',
          textSecondary: '#6b7280',
          border: '#e5e7eb',
          error: '#ef4444',
          warning: '#f59e0b',
          success: '#10b981',
          info: '#3b82f6'
        },
        typography: {
          fontFamily: 'Inter',
          fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
          fontWeight: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700 },
          lineHeight: { tight: 1.25, normal: 1.5, relaxed: 1.75 }
        },
        spacing: {
          xs: '0.25rem',
          sm: '0.5rem',
          md: '1rem',
          lg: '1.5rem',
          xl: '2rem',
          '2xl': '3rem',
          '3xl': '4rem',
          '4xl': '6rem'
        },
        shadows: {
          sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        },
        borderRadius: {
          none: '0',
          sm: '0.125rem',
          md: '0.375rem',
          lg: '0.5rem',
          full: '9999px'
        },
        animations: {
          enabled: true,
          duration: {
            fast: '150ms',
            normal: '300ms',
            slow: '500ms'
          },
          easing: {
            ease: 'ease',
            easeIn: 'ease-in',
            easeOut: 'ease-out',
            easeInOut: 'ease-in-out'
          }
        }
      },
      {
        id: 'dark',
        name: 'Dark',
        description: 'Thème sombre par défaut',
        category: 'built-in',
        colors: {
          primary: '#60a5fa',
          secondary: '#9ca3af',
          accent: '#34d399',
          background: '#111827',
          surface: '#1f2937',
          text: '#f9fafb',
          textSecondary: '#d1d5db',
          border: '#374151',
          error: '#f87171',
          warning: '#fbbf24',
          success: '#34d399',
          info: '#60a5fa'
        },
        typography: {
          fontFamily: 'Inter',
          fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
          fontWeight: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700 },
          lineHeight: { tight: 1.25, normal: 1.5, relaxed: 1.75 }
        },
        spacing: {
          xs: '0.25rem',
          sm: '0.5rem',
          md: '1rem',
          lg: '1.5rem',
          xl: '2rem',
          '2xl': '3rem',
          '3xl': '4rem',
          '4xl': '6rem'
        },
        shadows: {
          sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
          md: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
          lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
          xl: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
          '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
        },
        borderRadius: {
          none: '0',
          sm: '0.125rem',
          md: '0.375rem',
          lg: '0.5rem',
          full: '9999px'
        },
        animations: {
          enabled: true,
          duration: {
            fast: '150ms',
            normal: '300ms',
            slow: '500ms'
          },
          easing: {
            ease: 'ease',
            easeIn: 'ease-in',
            easeOut: 'ease-out',
            easeInOut: 'ease-in-out'
          }
        }
      }
    ];
  }

  private mapRowToTheme(row: any): Theme {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      colors: JSON.parse(row.colors),
      typography: JSON.parse(row.typography),
      spacing: JSON.parse(row.spacing),
      shadows: JSON.parse(row.shadows),
      borderRadius: JSON.parse(row.border_radius),
      animations: JSON.parse(row.animations),
      custom: row.custom
    };
  }

  private validateTheme(theme: Theme): ThemeValidationError[] {
    const errors: ThemeValidationError[] = [];

    // Validation des couleurs
    if (!theme.colors.primary) {
      errors.push({ field: 'colors.primary', message: 'Primary color is required', severity: 'error' });
    }
    if (!theme.colors.background) {
      errors.push({ field: 'colors.background', message: 'Background color is required', severity: 'error' });
    }
    if (!theme.colors.text) {
      errors.push({ field: 'colors.text', message: 'Text color is required', severity: 'error' });
    }

    // Validation de la typographie
    if (!theme.typography.fontFamily) {
      errors.push({ field: 'typography.fontFamily', message: 'Font family is required', severity: 'error' });
    }

    // Validation du nom
    if (!theme.name || theme.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Theme name is required', severity: 'error' });
    }

    return errors;
  }

  private async logPreferenceUpdate(userId: string, updates: Partial<UserPreferences>): Promise<void> {
    await this.db.query(`
      INSERT INTO personalization_analytics (user_id, action_type, metadata, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [userId, 'preference_update', JSON.stringify(updates)]);
  }

  private async logThemeCreation(userId: string, themeId: string): Promise<void> {
    await this.db.query(`
      INSERT INTO personalization_analytics (user_id, action_type, metadata, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [userId, 'theme_created', JSON.stringify({ themeId })]);
  }

  private async logThemeDeletion(userId: string, themeId: string): Promise<void> {
    await this.db.query(`
      INSERT INTO personalization_analytics (user_id, action_type, metadata, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [userId, 'theme_deleted', JSON.stringify({ themeId })]);
  }

  private async logThemeApplication(userId: string, themeId: string): Promise<void> {
    await this.db.query(`
      INSERT INTO personalization_analytics (user_id, action_type, metadata, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [userId, 'theme_change', JSON.stringify({ themeId })]);
  }

  private async logPreferenceImport(userId: string): Promise<void> {
    await this.db.query(`
      INSERT INTO personalization_analytics (user_id, action_type, metadata, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [userId, 'preference_import', JSON.stringify({})]);
  }

  private async getPreferencesUsage(userId: string): Promise<Record<string, number>> {
    const result = await this.db.query(`
      SELECT 
        metadata->>'category' as category,
        COUNT(*) as usage_count
      FROM personalization_analytics
      WHERE user_id = $1 AND action_type = 'preference_update'
      GROUP BY metadata->>'category'
    `, [userId]);

    const usage: Record<string, number> = {};
    for (const row of result.rows) {
      usage[row.category] = parseInt(row.usage_count);
    }
    return usage;
  }

  private async getThemeUsage(userId: string): Promise<Record<string, number>> {
    const result = await this.db.query(`
      SELECT 
        metadata->>'themeId' as theme_id,
        COUNT(*) as usage_count
      FROM personalization_analytics
      WHERE user_id = $1 AND action_type = 'theme_change'
      GROUP BY metadata->>'themeId'
    `, [userId]);

    const usage: Record<string, number> = {};
    for (const row of result.rows) {
      usage[row.theme_id] = parseInt(row.usage_count);
    }
    return usage;
  }
}
