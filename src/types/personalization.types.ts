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

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  '4xl': string;
}

export interface ThemeShadows {
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

export interface ThemeBorderRadius {
  none: string;
  sm: string;
  md: string;
  lg: string;
  full: string;
}

export interface ThemeAnimations {
  enabled: boolean;
  duration: {
    fast: string;
    normal: string;
    slow: string;
  };
  easing: {
    ease: string;
    easeIn: string;
    easeOut: string;
    easeInOut: string;
  };
}

export interface PersonalizationSettings {
  preferences: UserPreferences;
  customThemes: Theme[];
  activeTheme: string;
  lastUpdated: Date;
}

export interface ThemeExport {
  version: string;
  theme: Theme;
  exportedAt: string;
  metadata: {
    name: string;
    description: string;
    category: string;
  };
}

export interface PreferencesExport {
  version: string;
  exportedAt: string;
  preferences: {
    theme: ThemePreferences;
    layout: LayoutPreferences;
    chat: ChatPreferences;
    notifications: NotificationPreferences;
    accessibility: AccessibilityPreferences;
    shortcuts: ShortcutPreferences;
  };
}

export interface PersonalizationAnalytics {
  userId: string;
  themeChanges: number;
  customThemesCreated: number;
  settingsUpdates: number;
  lastActive: Date;
  preferencesUsage: Record<string, number>;
  themeUsage: Record<string, number>;
}

export interface ThemeValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ThemePreview {
  theme: Theme;
  preview: {
    colors: string[];
    typography: string;
    spacing: string;
    shadows: string[];
  };
  applied: boolean;
}
