import { PersonalizationService } from '../src/services/personalization.service';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { 
  UserPreferences, 
  Theme, 
  ThemeColors, 
  ThemeTypography,
  ThemeSpacing,
  ThemeShadows,
  ThemeBorderRadius,
  ThemeAnimations
} from '../src/types/personalization.types';

// Mocks
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn()
  }))
}));

jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn()
  }))
}));

describe('PersonalizationService', () => {
  let service: PersonalizationService;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockDb = new Pool() as jest.Mocked<Pool>;
    mockRedis = new Redis() as jest.Mocked<Redis>;
    service = new PersonalizationService(mockDb, mockRedis);
  });

  describe('getUserPreferences', () => {
    it('should return cached preferences when available', async () => {
      const userId = 'user123';
      const cachedPreferences = {
        userId,
        theme: { mode: 'dark', primaryColor: '#000000' },
        layout: { sidebarPosition: 'left' },
        chat: { defaultProvider: 'openai' },
        notifications: { desktop: true },
        accessibility: { highContrast: false },
        privacy: { shareAnalytics: true },
        performance: { enableAnimations: true },
        shortcuts: { modifierKey: 'ctrl' }
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedPreferences));

      const result = await service.getUserPreferences(userId);

      expect(mockRedis.get).toHaveBeenCalledWith(`user_preferences:${userId}`);
      expect(result).toEqual(cachedPreferences);
    });

    it('should create default preferences for new user', async () => {
      const userId = 'new-user';
      
      mockRedis.get.mockResolvedValue(null);
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await service.getUserPreferences(userId);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.theme.mode).toBe('auto');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_preferences'),
        expect.any(Array)
      );
    });

    it('should retrieve preferences from database when not cached', async () => {
      const userId = 'user123';
      const dbPreferences = {
        userId,
        theme: { mode: 'light', primaryColor: '#ffffff' },
        layout: { sidebarPosition: 'right' },
        chat: { defaultProvider: 'anthropic' },
        notifications: { desktop: false },
        accessibility: { highContrast: true },
        privacy: { shareAnalytics: false },
        performance: { enableAnimations: false },
        shortcuts: { modifierKey: 'alt' }
      };

      mockRedis.get.mockResolvedValue(null);
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [{ preferences: JSON.stringify(dbPreferences) }] });

      const result = await service.getUserPreferences(userId);

      expect(result).toEqual(dbPreferences);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `user_preferences:${userId}`,
        3600,
        JSON.stringify(dbPreferences)
      );
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences successfully', async () => {
      const userId = 'user123';
      const currentPreferences = {
        userId,
        theme: { mode: 'dark', primaryColor: '#000000' },
        layout: { sidebarPosition: 'left' },
        chat: { defaultProvider: 'openai' },
        notifications: { desktop: true },
        accessibility: { highContrast: false },
        privacy: { shareAnalytics: true },
        performance: { enableAnimations: true },
        shortcuts: { modifierKey: 'ctrl' }
      };

      const updates = {
        theme: { 
          mode: 'light' as const, 
          primaryColor: '#ffffff',
          accentColor: '#10b981',
          backgroundColor: '#ffffff',
          textColor: '#000000',
          fontFamily: 'Inter',
          fontSize: 'md' as const,
          borderRadius: 'md' as const,
          animations: true,
          reducedMotion: false
        }
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(currentPreferences));
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await service.updateUserPreferences(userId, updates);

      expect(result.theme.mode).toBe('light');
      expect(result.theme.primaryColor).toBe('#ffffff');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_preferences'),
        expect.arrayContaining([JSON.stringify(result)])
      );
    });
  });

  describe('getTheme', () => {
    it('should return cached theme when available', async () => {
      const themeId = 'custom-theme-1';
      const cachedTheme: Theme = {
        id: themeId,
        name: 'Custom Theme',
        description: 'A custom theme',
        category: 'custom',
        colors: { primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff', background: '#ffffff', surface: '#f0f0f0', text: '#000000', textSecondary: '#666666', border: '#cccccc', error: '#ff0000', warning: '#ffaa00', success: '#00ff00', info: '#0088ff' },
        typography: { fontFamily: 'Arial', fontSize: { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '20px', '2xl': '24px', '3xl': '32px' }, fontWeight: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700 }, lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.8 } },
        spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px', '3xl': '64px', '4xl': '96px' },
        shadows: { sm: '0 1px 2px rgba(0,0,0,0.1)', md: '0 4px 6px rgba(0,0,0,0.1)', lg: '0 10px 15px rgba(0,0,0,0.1)', xl: '0 20px 25px rgba(0,0,0,0.1)', '2xl': '0 25px 50px rgba(0,0,0,0.25)' },
        borderRadius: { none: '0', sm: '4px', md: '8px', lg: '12px', full: '9999px' },
        animations: { enabled: true, duration: { fast: '150ms', normal: '300ms', slow: '500ms' }, easing: { ease: 'ease', easeIn: 'ease-in', easeOut: 'ease-out', easeInOut: 'ease-in-out' } }
      };

      // Simuler le cache interne
      (service as any).themeCache.set(themeId, cachedTheme);

      const result = await service.getTheme(themeId);

      expect(result).toEqual(cachedTheme);
    });

    it('should return default theme when requested', async () => {
      const themeId = 'light';

      const result = await service.getTheme(themeId);

      expect(result).toBeDefined();
      expect(result!.id).toBe('light');
      expect(result!.category).toBe('built-in');
    });

    it('should return null for non-existent theme', async () => {
      const themeId = 'non-existent';

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await service.getTheme(themeId);

      expect(result).toBeNull();
    });
  });

  describe('createCustomTheme', () => {
    it('should create a custom theme successfully', async () => {
      const userId = 'user123';
      const themeData = {
        name: 'My Custom Theme',
        description: 'A theme I created',
        colors: { primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff', background: '#ffffff', surface: '#f0f0f0', text: '#000000', textSecondary: '#666666', border: '#cccccc', error: '#ff0000', warning: '#ffaa00', success: '#00ff00', info: '#0088ff' },
        typography: { fontFamily: 'Arial', fontSize: { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '20px', '2xl': '24px', '3xl': '32px' }, fontWeight: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700 }, lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.8 } },
        spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px', '3xl': '64px', '4xl': '96px' },
        shadows: { sm: '0 1px 2px rgba(0,0,0,0.1)', md: '0 4px 6px rgba(0,0,0,0.1)', lg: '0 10px 15px rgba(0,0,0,0.1)', xl: '0 20px 25px rgba(0,0,0,0.1)', '2xl': '0 25px 50px rgba(0,0,0,0.25)' },
        borderRadius: { none: '0', sm: '4px', md: '8px', lg: '12px', full: '9999px' },
        animations: { enabled: true, duration: { fast: '150ms', normal: '300ms', slow: '500ms' }, easing: { ease: 'ease', easeIn: 'ease-in', easeOut: 'ease-out', easeInOut: 'ease-in-out' } }
      };

      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await service.createCustomTheme(userId, themeData);

      expect(result.name).toBe('My Custom Theme');
      expect(result.category).toBe('custom');
      expect(result.custom).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO themes'),
        expect.arrayContaining([
          expect.any(String), // themeId
          'My Custom Theme',
          'A theme I created',
          'custom',
          JSON.stringify(themeData.colors),
          JSON.stringify(themeData.typography),
          JSON.stringify(themeData.spacing),
          JSON.stringify(themeData.shadows),
          JSON.stringify(themeData.borderRadius),
          JSON.stringify(themeData.animations),
          true,
          userId
        ])
      );
    });

    it('should throw error for invalid theme data', async () => {
      const userId = 'user123';
      const invalidThemeData = {
        name: '',
        description: '',
        colors: { 
          primary: '#000000', 
          secondary: '#666666', 
          accent: '#0000ff', 
          background: '#ffffff', 
          surface: '#f0f0f0', 
          text: '#000000', 
          textSecondary: '#666666', 
          border: '#cccccc', 
          error: '#ff0000', 
          warning: '#ffaa00', 
          success: '#00ff00', 
          info: '#0088ff' 
        },
        typography: { 
          fontFamily: 'Arial', 
          fontSize: { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '20px', '2xl': '24px', '3xl': '32px' }, 
          fontWeight: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700 }, 
          lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.8 } 
        },
        shadows: { 
          sm: '0 1px 2px rgba(0,0,0,0.1)', 
          md: '0 4px 6px rgba(0,0,0,0.1)', 
          lg: '0 10px 15px rgba(0,0,0,0.1)', 
          xl: '0 20px 25px rgba(0,0,0,0.1)', 
          '2xl': '0 25px 50px rgba(0,0,0,0.25)' 
        },
        borderRadius: { 
          none: '0', 
          sm: '4px', 
          md: '8px', 
          lg: '12px', 
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
        },
        spacing: { 
          xs: '4px', 
          sm: '8px', 
          md: '16px', 
          lg: '24px', 
          xl: '32px', 
          '2xl': '48px', 
          '3xl': '64px', 
          '4xl': '96px' 
        }
      };

      await expect(service.createCustomTheme(userId, invalidThemeData))
        .rejects.toThrow('Theme validation failed');
    });
  });

  describe('applyTheme', () => {
    it('should apply theme to user preferences', async () => {
      const userId = 'user123';
      const themeId = 'light';
      const currentPreferences = {
        userId,
        theme: { mode: 'dark', primaryColor: '#000000' },
        layout: { sidebarPosition: 'left' },
        chat: { defaultProvider: 'openai' },
        notifications: { desktop: true },
        accessibility: { highContrast: false },
        privacy: { shareAnalytics: true },
        performance: { enableAnimations: true },
        shortcuts: { modifierKey: 'ctrl' }
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(currentPreferences));
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      await service.applyTheme(userId, themeId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_preferences'),
        expect.arrayContaining([
          expect.any(String),
          expect.stringContaining('"primary":"#3b82f6"')
        ])
      );
    });

    it('should throw error for non-existent theme', async () => {
      const userId = 'user123';
      const themeId = 'non-existent';

      await expect(service.applyTheme(userId, themeId))
        .rejects.toThrow('Theme non-existent not found');
    });
  });

  describe('exportPreferences', () => {
    it('should export preferences as JSON string', async () => {
      const userId = 'user123';
      const preferences = {
        userId,
        theme: { mode: 'dark', primaryColor: '#000000' },
        layout: { sidebarPosition: 'left' },
        chat: { defaultProvider: 'openai' },
        notifications: { desktop: true },
        accessibility: { highContrast: false },
        privacy: { shareAnalytics: true },
        performance: { enableAnimations: true },
        shortcuts: { modifierKey: 'ctrl' }
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(preferences));

      const result = await service.exportPreferences(userId);

      const parsed = JSON.parse(result);
      expect(parsed.version).toBe('1.0');
      expect(parsed.preferences.theme.mode).toBe('dark');
      expect(parsed.preferences.chat.defaultProvider).toBe('openai');
    });
  });

  describe('importPreferences', () => {
    it('should import preferences successfully', async () => {
      const userId = 'user123';
      const importData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        preferences: {
          theme: { mode: 'light', primaryColor: '#ffffff' },
          layout: { sidebarPosition: 'right' },
          chat: { defaultProvider: 'anthropic' },
          notifications: { desktop: false },
          accessibility: { highContrast: true },
          shortcuts: { modifierKey: 'alt' }
        }
      };

      const currentPreferences = {
        userId,
        theme: { mode: 'dark', primaryColor: '#000000' },
        layout: { sidebarPosition: 'left' },
        chat: { defaultProvider: 'openai' },
        notifications: { desktop: true },
        accessibility: { highContrast: false },
        privacy: { shareAnalytics: true },
        performance: { enableAnimations: true },
        shortcuts: { modifierKey: 'ctrl' }
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(currentPreferences));
      (mockDb.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await service.importPreferences(userId, JSON.stringify(importData));

      expect(result.theme.mode).toBe('light');
      expect(result.layout.sidebarPosition).toBe('right');
      expect(result.chat.defaultProvider).toBe('anthropic');
    });

    it('should throw error for invalid version', async () => {
      const userId = 'user123';
      const invalidImportData = {
        version: '2.0',
        preferences: {}
      };

      await expect(service.importPreferences(userId, JSON.stringify(invalidImportData)))
        .rejects.toThrow('Unsupported preferences version');
    });

    it('should throw error for invalid JSON', async () => {
      const userId = 'user123';
      const invalidJSON = '{ invalid json }';

      await expect(service.importPreferences(userId, invalidJSON))
        .rejects.toThrow('Invalid preferences data');
    });
  });

  describe('getAnalytics', () => {
    it('should return user analytics', async () => {
      const userId = 'user123';
      const analyticsData = {
        rows: [{
          theme_changes: '5',
          custom_themes_created: '2',
          settings_updates: '10',
          last_active: new Date().toISOString()
        }]
      };

      const preferencesUsage = { theme: 3, layout: 2 };
      const themeUsage = { light: 2, dark: 3 };

      (mockDb.query as jest.Mock)
        .mockResolvedValueOnce(analyticsData)
        .mockResolvedValueOnce({ rows: Object.entries(preferencesUsage).map(([k, v]) => ({ category: k, usage_count: v })) })
        .mockResolvedValueOnce({ rows: Object.entries(themeUsage).map(([k, v]) => ({ theme_id: k, usage_count: v })) });

      const result = await service.getAnalytics(userId);

      expect(result.userId).toBe(userId);
      expect(result.themeChanges).toBe(5);
      expect(result.customThemesCreated).toBe(2);
      expect(result.settingsUpdates).toBe(10);
      expect(result.preferencesUsage).toEqual(preferencesUsage);
      expect(result.themeUsage).toEqual(themeUsage);
    });
  });

  describe('validateTheme', () => {
    it('should validate theme correctly', async () => {
      const validTheme: Theme = {
        id: 'test-theme',
        name: 'Test Theme',
        description: 'A test theme',
        category: 'custom',
        colors: { primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff', background: '#ffffff', surface: '#f0f0f0', text: '#000000', textSecondary: '#666666', border: '#cccccc', error: '#ff0000', warning: '#ffaa00', success: '#00ff00', info: '#0088ff' },
        typography: { fontFamily: 'Arial', fontSize: { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '20px', '2xl': '24px', '3xl': '32px' }, fontWeight: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700 }, lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.8 } },
        spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', '2xl': '48px', '3xl': '64px', '4xl': '96px' },
        shadows: { sm: '0 1px 2px rgba(0,0,0,0.1)', md: '0 4px 6px rgba(0,0,0,0.1)', lg: '0 10px 15px rgba(0,0,0,0.1)', xl: '0 20px 25px rgba(0,0,0,0.1)', '2xl': '0 25px 50px rgba(0,0,0,0.25)' },
        borderRadius: { none: '0', sm: '4px', md: '8px', lg: '12px', full: '9999px' },
        animations: { enabled: true, duration: { fast: '150ms', normal: '300ms', slow: '500ms' }, easing: { ease: 'ease', easeIn: 'ease-in', easeOut: 'ease-out', easeInOut: 'ease-in-out' } }
      };

      // Accès privé à la méthode de validation
      const validationErrors = (service as any).validateTheme(validTheme);

      expect(validationErrors).toHaveLength(0);
    });

    it('should detect validation errors', async () => {
      const invalidTheme = {
        id: 'invalid-theme',
        name: '',
        category: 'custom',
        colors: {},
        typography: { 
          fontFamily: 'Arial', 
          fontSize: { xs: '12px', sm: '14px', md: '16px', lg: '18px', xl: '20px', '2xl': '24px', '3xl': '32px' }, 
          fontWeight: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700 }, 
          lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.8 } 
        },
        shadows: { 
          sm: '0 1px 2px rgba(0,0,0,0.1)', 
          md: '0 4px 6px rgba(0,0,0,0.1)', 
          lg: '0 10px 15px rgba(0,0,0,0.1)', 
          xl: '0 20px 25px rgba(0,0,0,0.1)', 
          '2xl': '0 25px 50px rgba(0,0,0,0.25)' 
        },
        borderRadius: { 
          none: '0', 
          sm: '4px', 
          md: '8px', 
          lg: '12px', 
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
        },
        spacing: { 
          xs: '4px', 
          sm: '8px', 
          md: '16px', 
          lg: '24px', 
          xl: '32px', 
          '2xl': '48px', 
          '3xl': '64px', 
          '4xl': '96px' 
        }
      };

      const validationErrors = (service as any).validateTheme(invalidTheme);

      expect(validationErrors.length).toBeGreaterThan(0);
      expect(validationErrors.some((e: any) => e.field === 'colors.primary')).toBe(true);
      expect(validationErrors.some((e: any) => e.field === 'name')).toBe(true);
    });
  });
});
