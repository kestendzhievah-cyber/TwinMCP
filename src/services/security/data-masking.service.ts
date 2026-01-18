export class DataMaskingService {
  private readonly maskingRules: MaskingRule[] = [
    {
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      mask: (match: string) => {
        const [username, domain] = match.split('@');
        const maskedUsername = username.slice(0, 2) + '***';
        return `${maskedUsername}@${domain}`;
      }
    },
    {
      pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      mask: (match: string) => {
        return match.replace(/\d(?=\d{4})/g, '*');
      }
    },
    {
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      mask: (match: string) => {
        return match.replace(/\d(?=\d{4})/g, '*');
      }
    },
    {
      pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      mask: (match: string) => {
        const parts = match.split('.');
        return `${parts[0]}.${parts[1]}.*.*`;
      }
    }
  ];

  maskData(data: any, context: string = 'default'): any {
    if (typeof data === 'string') {
      return this.maskString(data, context);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.maskData(item, context));
    }

    if (typeof data === 'object' && data !== null) {
      const masked: any = {};
      for (const [key, value] of Object.entries(data)) {
        masked[key] = this.maskData(value, `${context}.${key}`);
      }
      return masked;
    }

    return data;
  }

  private maskString(text: string, context: string): string {
    let masked = text;
    
    for (const rule of this.maskingRules) {
      if (rule.contexts && !rule.contexts.includes(context)) {
        continue;
      }
      
      masked = masked.replace(rule.pattern, rule.mask);
    }
    
    return masked;
  }

  maskForLogging(data: any): any {
    return this.maskData(data, 'logging');
  }

  maskForAnalytics(data: any): any {
    return this.maskData(data, 'analytics');
  }
}

interface MaskingRule {
  pattern: RegExp;
  mask: (match: string) => string;
  contexts?: string[];
}
