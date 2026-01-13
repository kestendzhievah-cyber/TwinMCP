# E8-Story8-4-Personnalisation-Interface.md

## Epic 8: Chat Interface

### Story 8.4: Personnalisation de l'interface

**Description**: Thèmes, préférences utilisateur et configuration avancée

---

## Objectif

Développer un système complet de personnalisation avec thèmes multiples, préférences utilisateur persistantes, layouts configurables et expérience adaptative.

---

## Prérequis

- Interface de chat (Story 8.1) opérationnelle
- Gestion des conversations (Story 8.2) en place
- Service d'authentification (Epic 3) disponible
- Base de données configurée

---

## Spécifications Techniques

### 1. Architecture de Personnalisation

#### 1.1 Types et Interfaces

```typescript
// src/types/personalization.types.ts
export interface UserPreferences {
  userId: string;
  theme: ThemePreferences;
  layout: LayoutPreferences;
  chat: ChatPreferences;
  notifications: NotificationPreferences;
  accessibility: AccessibilityPreferences;
  privacy: PrivacyPreferences;
  performance: PerformancePreferences;
  shortcuts: ShortcutPreferences;
}

export interface ThemePreferences {
  mode: 'light' | 'dark' | 'auto' | 'system';
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  customCSS?: string;
  fontFamily: string;
  fontSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  animations: boolean;
  reducedMotion: boolean;
}

export interface LayoutPreferences {
  sidebarPosition: 'left' | 'right';
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  showConversationList: boolean;
  showModelSelector: boolean;
  showSettingsButton: boolean;
  messageLayout: 'bubble' | 'linear' | 'compact';
  inputPosition: 'bottom' | 'side';
  showTimestamps: boolean;
  showAvatars: boolean;
  showReactions: boolean;
  compactMode: boolean;
}

export interface ChatPreferences {
  defaultProvider: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  streamResponse: boolean;
  autoSave: boolean;
  showContext: boolean;
  contextPosition: 'top' | 'side' | 'bottom';
  showTokenCount: boolean;
  showCost: boolean;
  showLatency: boolean;
  messageHistory: number;
  autoScroll: boolean;
}

export interface NotificationPreferences {
  desktop: boolean;
  sound: boolean;
  email: boolean;
  types: {
    newMessage: boolean;
    responseComplete: boolean;
    error: boolean;
    systemUpdate: boolean;
    shareNotification: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
  frequency: 'all' | 'important' | 'none';
}

export interface AccessibilityPreferences {
  highContrast: boolean;
  largeText: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
  focusVisible: boolean;
  reducedMotion: boolean;
  colorBlindFriendly: boolean;
  dyslexiaFont: boolean;
  lineSpacing: 'normal' | 'relaxed' | 'loose';
  wordSpacing: 'normal' | 'wide' | 'wider';
}

export interface PrivacyPreferences {
  shareAnalytics: boolean;
    shareConversations: boolean;
    saveHistory: boolean;
    encryptMessages: boolean;
    autoDelete: {
      enabled: boolean;
      days: number;
    };
    dataRetention: {
      conversations: number;
      messages: number;
      files: number;
    };
    gdprCompliance: boolean;
}

export interface PerformancePreferences {
    enableAnimations: boolean;
    enableTransitions: boolean;
    enableShadows: boolean;
    enableBlur: boolean;
    maxConversations: number;
    maxMessagesPerConversation: number;
    cacheSize: number;
    preloadContent: boolean;
    lazyLoading: boolean;
}

export interface ShortcutPreferences {
    customShortcuts: Record<string, string>;
    enabledShortcuts: string[];
    modifierKey: 'ctrl' | 'alt' | 'meta';
    showHelp: boolean;
}

export interface Theme {
    id: string;
    name: string;
    description: string;
    category: 'built-in' | 'custom' | 'community';
    colors: ThemeColors;
    typography: ThemeTypography;
    spacing: ThemeSpacing;
    shadows: ThemeShadows;
    borderRadius: ThemeBorderRadius;
    animations: ThemeAnimations;
    custom?: boolean;
}

export interface ThemeColors {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
}

export interface ThemeTypography {
    fontFamily: string;
    fontSize: {
        xs: string;
        sm: string;
        md: string;
        lg: string;
        xl: string;
        '2xl': string;
        '3xl': string;
    };
    fontWeight: {
        light: number;
        normal: number;
        medium: number;
        semibold: number;
        bold: number;
    };
    lineHeight: {
        tight: number;
        normal: number;
        relaxed: number;
    };
}
```

#### 1.2 Service de Personnalisation

```typescript
// src/services/personalization.service.ts
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { UserPreferences, Theme } from '../types/personalization.types';

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

        await this.db.query(`
            INSERT INTO themes (
                id, name, description, category, colors, typography,
                spacing, shadows, borderRadius, animations, custom, created_by
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

        return fullTheme;
    }

    async applyTheme(userId: string, themeId: string): Promise<void> {
        const theme = await this.getTheme(themeId);
        if (!theme) {
            throw new Error(`Theme ${themeId} not found`);
        }

        await this.updateUserPreferences(userId, {
            theme: {
                mode: 'custom',
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
    }

    async exportPreferences(userId: string): Promise<string> {
        const preferences = await this.getUserPreferences(userId);
        
        const exportData = {
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
            const importData = JSON.parse(data);
            
            if (importData.version !== '1.0') {
                throw new Error('Unsupported preferences version');
            }

            const updates = importData.preferences;
            return await this.updateUserPreferences(userId, updates);
            
        } catch (error) {
            throw new Error(`Invalid preferences data: ${error.message}`);
        }
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
                spacing: {},
                shadows: {},
                borderRadius: {},
                animations: { enabled: true }
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
                spacing: {},
                shadows: {},
                borderRadius: {},
                animations: { enabled: true }
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
}
```

---

## Tâches Détaillées

### 1. Service de Personnalisation
- [ ] Implémenter PersonalizationService
- [ ] Gérer les préférences utilisateur
- [ ] Créer le système de thèmes
- [ ] Ajouter le cache des préférences

### 2. Interface de Configuration
- [ ] Développer le panneau de settings
- [ ] Créer l'éditeur de thèmes
- [ ] Ajouter la gestion des raccourcis
- [ ] Implémenter l'export/import

### 3. Thèmes et Styles
- [ ] Créer les thèmes par défaut
- [ ] Développer l'éditeur de thèmes
- [ ] Ajouter le support CSS custom
- [ ] Implémenter les animations

### 4. Accessibilité et Performance
- [ ] Ajouter les options d'accessibilité
- [ ] Optimiser les performances
- [ ] Créer le mode compact
- [ ] Implémenter le mode lecture

---

## Validation

### Tests du Service

```typescript
// __tests__/personalization.service.test.ts
describe('PersonalizationService', () => {
    let service: PersonalizationService;

    beforeEach(() => {
        service = new PersonalizationService(mockDb, mockRedis);
    });

    describe('getUserPreferences', () => {
        it('should return default preferences for new user', async () => {
            const preferences = await service.getUserPreferences('new-user');

            expect(preferences).toBeDefined();
            expect(preferences.userId).toBe('new-user');
            expect(preferences.theme.mode).toBe('auto');
        });
    });

    describe('updateUserPreferences', () => {
        it('should update user preferences', async () => {
            const updates = {
                theme: {
                    mode: 'dark' as const,
                    primaryColor: '#60a5fa'
                }
            };

            const updated = await service.updateUserPreferences('user123', updates);

            expect(updated.theme.mode).toBe('dark');
            expect(updated.theme.primaryColor).toBe('#60a5fa');
        });
    });
});
```

---

## Architecture

### Composants

1. **PersonalizationService**: Service principal
2. **ThemeEngine**: Moteur de thèmes
3. **SettingsPanel**: Panneau de configuration
4. **ThemeEditor**: Éditeur de thèmes
5. **PreferenceManager**: Gestionnaire de préférences

### Flux de Personnalisation

```
User Action → Service → Validation → Storage → Cache → UI Update
```

---

## Performance

### Optimisations

- **Preference Caching**: Cache des préférences
- **Theme Preloading**: Préchargement des thèmes
- **Lazy Loading**: Chargement à la demande
- **CSS Optimization**: Optimisation CSS

### Métriques Cibles

- **Preference Load**: < 50ms
- **Theme Switch**: < 100ms
- **Settings Save**: < 200ms
- **Cache Hit Rate**: > 90%

---

## Monitoring

### Métriques

- `preferences.updates.total`: Mises à jour des préférences
- `themes.custom.created`: Thèmes personnalisés créés
- `themes.switched`: Changements de thème
- `settings.accessed`: Accès aux settings
- `preferences.exported`: Exportations de préférences

---

## Livrables

1. **PersonalizationService**: Service complet
2. **Settings UI**: Interface de configuration
3. **Theme Engine**: Moteur de thèmes
4. **Theme Editor**: Éditeur de thèmes
5. **Export/Import**: Système d'export/import

---

## Critères de Succès

- [ ] Personnalisation complète fonctionnelle
- [ ] Thèmes multiples disponibles
- [ ] Accessibilité respectée
- [ ] Performance optimale
- [ ] Tests avec couverture > 90%
- [ ] Documentation complète

---

## Suivi

### Post-Implémentation

1. **Usage Analytics**: Analyse de l'utilisation
2. **Theme Popularity**: Popularité des thèmes
3. **User Feedback**: Collecte des retours
4. **Performance Monitoring**: Surveillance des performances
