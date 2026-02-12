import { PromptTemplate, PromptVariable, PromptRenderResult } from '../types/prompt-system.types';

export class PromptRenderer {
  async render(
    template: PromptTemplate, 
    variables: Record<string, any>,
    context?: any
  ): Promise<PromptRenderResult> {
    const startTime = Date.now();
    
    let rendered = template.template;
    const replacedVariables: string[] = [];

    // Remplacement des variables
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      if (rendered.includes(placeholder)) {
        rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
        replacedVariables.push(key);
      }
    }

    // Gestion des variables conditionnelles
    rendered = this.processConditionals(rendered, variables);

    // Gestion des boucles
    rendered = this.processLoops(rendered, variables);

    const processingTime = Date.now() - startTime;

    return {
      prompt: rendered,
      metadata: {
        tokensUsed: Math.ceil(rendered.length / 4),
        variablesReplaced: replacedVariables,
        processingTime
      }
    };
  }

  async validateSyntax(template: string, variables: PromptVariable[]): Promise<void> {
    // Validation des placeholders
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const matches = template.match(placeholderRegex);
    
    if (matches) {
      for (const match of matches) {
        const varName = match.slice(2, -2);
        const variable = variables.find(v => v.name === varName);
        
        if (!variable) {
          throw new Error(`Undefined variable: ${varName}`);
        }
      }
    }

    // Validation des conditionnelles
    this.validateConditionals(template);

    // Validation des boucles
    this.validateLoops(template);
  }

  private processConditionals(template: string, variables: Record<string, any>): string {
    // Traitement des blocs conditionnels {% if variable %} ... {% endif %}
    const conditionalRegex = /\{%\s*if\s+(\w+)\s*%\}(.*?)\{%\s*endif\s*%\}/gs;
    
    return template.replace(conditionalRegex, (match, varName, content) => {
      return variables[varName] ? content : '';
    });
  }

  private processLoops(template: string, variables: Record<string, any>): string {
    // Traitement des boucles {% for item in array %} ... {% endfor %}
    const loopRegex = /\{%\s*for\s+(\w+)\s+in\s+(\w+)\s*%\}(.*?)\{%\s*endfor\s*%\}/gs;
    
    return template.replace(loopRegex, (match, itemName, arrayName, content) => {
      const array = variables[arrayName];
      if (!Array.isArray(array)) return '';
      
      return array.map(item => {
        return content.replace(new RegExp(`\\{\\{${itemName}\\}\\}`, 'g'), String(item));
      }).join('');
    });
  }

  private validateConditionals(template: string): void {
    const conditionalRegex = /\{%\s*if\s+(\w+)\s*%\}/g;
    const endifRegex = /\{%\s*endif\s*%\}/g;
    
    const ifMatches = (template.match(conditionalRegex) || []).length;
    const endifMatches = (template.match(endifRegex) || []).length;
    
    if (ifMatches !== endifMatches) {
      throw new Error('Mismatched conditional blocks');
    }
  }

  private validateLoops(template: string): void {
    const forRegex = /\{%\s*for\s+\w+\s+in\s+\w+\s*%\}/g;
    const endforRegex = /\{%\s*endfor\s*%\}/g;
    
    const forMatches = (template.match(forRegex) || []).length;
    const endforMatches = (template.match(endforRegex) || []).length;
    
    if (forMatches !== endforMatches) {
      throw new Error('Mismatched loop blocks');
    }
  }
}
