import { ContextTemplate, ContextResult, ContextInjection } from '../types/context-intelligent.types';

export class ContextTemplateEngine {
  private templates: Map<string, ContextTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  async getTemplate(type: string): Promise<ContextTemplate> {
    const template = this.templates.get(type);
    if (!template) {
      throw new Error(`Template not found: ${type}`);
    }
    
    // Mise à jour du compteur d'utilisation
    template.metadata.usageCount++;
    template.metadata.updatedAt = new Date();
    
    return template;
  }

  async render(template: ContextTemplate | string, data: any): Promise<string> {
    const templateContent = typeof template === 'string' ? template : template.template;
    
    // Substitution simple des variables
    let rendered = templateContent;
    
    // Substitution des variables {{variable}}
    const variableRegex = /\{\{(\w+)\}\}/g;
    rendered = rendered.replace(variableRegex, (match, varName) => {
      if (data[varName] !== undefined) {
        return String(data[varName]);
      }
      return `[${varName}]`;
    });

    // Support des conditionnelles {% if condition %}...{% endif %}
    rendered = this.processConditionals(rendered, data);

    // Support des boucles {% for item in array %}...{% endfor %}
    rendered = this.processLoops(rendered, data);

    return rendered;
  }

  async createTemplate(template: Omit<ContextTemplate, 'id' | 'metadata'>): Promise<ContextTemplate> {
    const newTemplate: ContextTemplate = {
      id: crypto.randomUUID(),
      ...template,
      metadata: {
        description: template.template.substring(0, 100),
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0
      }
    };

    this.templates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  async updateTemplate(id: string, updates: Partial<ContextTemplate>): Promise<ContextTemplate> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }

    const updatedTemplate: ContextTemplate = {
      ...template,
      ...updates,
      id: template.id, // Preserve ID
      metadata: {
        ...template.metadata,
        ...updates.metadata,
        updatedAt: new Date()
      }
    };

    this.templates.set(id, updatedTemplate);
    return updatedTemplate;
  }

  async deleteTemplate(id: string): Promise<void> {
    if (!this.templates.has(id)) {
      throw new Error(`Template not found: ${id}`);
    }
    this.templates.delete(id);
  }

  async listTemplates(): Promise<ContextTemplate[]> {
    return Array.from(this.templates.values());
  }

  async getTemplateStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    mostUsed: ContextTemplate[];
  }> {
    const templates = Array.from(this.templates.values());
    const byType: Record<string, number> = {};
    
    templates.forEach(template => {
      byType[template.type] = (byType[template.type] || 0) + 1;
    });

    const mostUsed = templates
      .sort((a, b) => b.metadata.usageCount - a.metadata.usageCount)
      .slice(0, 5);

    return {
      total: templates.length,
      byType,
      mostUsed
    };
  }

  private processConditionals(template: string, data: any): string {
    const conditionalRegex = /\{%\s*if\s+(\w+)\s*%\}(.*?)\{%\s*endif\s*%\}/gs;
    
    return template.replace(conditionalRegex, (match, condition, content) => {
      const value = this.getNestedValue(data, condition);
      return value ? content : '';
    });
  }

  private processLoops(template: string, data: any): string {
    const loopRegex = /\{%\s*for\s+(\w+)\s+in\s+(\w+)\s*%\}(.*?)\{%\s*endfor\s*%\}/gs;
    
    return template.replace(loopRegex, (match, itemVar, arrayVar, content) => {
      const array = this.getNestedValue(data, arrayVar);
      if (!Array.isArray(array)) {
        return '';
      }

      return array.map((item, index) => {
        let itemContent = content;
        
        // Remplacement des variables de l'item
        itemContent = itemContent.replace(
          new RegExp(`\\{\\{${itemVar}\\.(\\w+)\\}\\}`, 'g'),
          (match, prop) => String(item[prop] || `[${itemVar}.${prop}]`)
        );
        
        // Variables de boucle
        itemContent = itemContent.replace(/\{\{index\}\}/g, String(index));
        itemContent = itemContent.replace(/\{\{first\}\}/g, index === 0 ? 'true' : 'false');
        itemContent = itemContent.replace(/\{\{last\}\}/g, index === array.length - 1 ? 'true' : 'false');
        
        return itemContent;
      }).join('');
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  private initializeDefaultTemplates(): void {
    const defaultTemplates: Omit<ContextTemplate, 'id' | 'metadata'>[] = [
      {
        name: 'Contexte Général',
        type: 'general_context',
        template: `Contexte pertinent pour votre question:

{{summary}}

Sources principales:
{{#each sources}}
- {{title}} (Pertinence: {{metadata.relevanceScore}})
{{/each}}

Question originale: {{userMessage}}

Répondez en utilisant les informations ci-dessus.`,
        variables: ['summary', 'sources', 'userMessage']
      },
      {
        name: 'Contexte Code',
        type: 'code_context',
        template: `Contexte de développement pour votre question:

{{summary}}

Extraits de code pertinents:
{{#each chunks}}
{{#if metadata.codeBlocks > 0}}
\`\`\`{{metadata.language}}
{{content}}
\`\`\`
{{/if}}
{{/each}}

Documentation associée:
{{#each sources}}
- {{title}}: {{url}}
{{/each}}

Question: {{userMessage}}

Fournissez une réponse technique avec des exemples de code si approprié.`,
        variables: ['summary', 'chunks', 'sources', 'userMessage']
      },
      {
        name: 'Contexte API',
        type: 'api_context',
        template: `Documentation API pour votre requête:

{{summary}}

Références API:
{{#each sources}}
{{#if type="api"}}
**{{title}}**
{{content}}
{{url}}
{{/if}}
{{/each}}

Paramètres et exemples:
{{#each chunks}}
{{content}}
{{/each}}

Question: {{userMessage}}

Répondez avec des détails spécifiques sur l'utilisation de l'API.`,
        variables: ['summary', 'sources', 'chunks', 'userMessage']
      },
      {
        name: 'Contexte Exemples',
        type: 'example_context',
        template: `Exemples pertinents pour votre demande:

{{summary}}

Exemples pratiques:
{{#each sources}}
{{#if type="example"}}
**{{title}}**
{{content}}
{{/if}}
{{/each}}

Extraits de code:
{{#each chunks}}
{{#if metadata.codeBlocks > 0}}
\`\`\`
{{content}}
\`\`\`
{{/if}}
{{/each}}

Question: {{userMessage}}

Fournissez des exemples concrets et expliqués.`,
        variables: ['summary', 'sources', 'chunks', 'userMessage']
      },
      {
        name: 'Contexte Tutoriel',
        type: 'tutorial_context',
        template: `Guide tutoriel pour votre apprentissage:

{{summary}}

Étapes recommandées:
{{#each sources}}
{{#if type="tutorial"}}
**{{title}}**
{{content}}
{{/if}}
{{/each}}

Instructions détaillées:
{{#each chunks}}
{{content}}
{{/each}}

Question: {{userMessage}}

Guidez l'utilisateur pas à pas avec des instructions claires.`,
        variables: ['summary', 'sources', 'chunks', 'userMessage']
      }
    ];

    defaultTemplates.forEach(template => {
      const contextTemplate: ContextTemplate = {
        id: crypto.randomUUID(),
        ...template,
        metadata: {
          description: template.template.substring(0, 100),
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0
        }
      };
      this.templates.set(contextTemplate.id, contextTemplate);
    });
  }
}
