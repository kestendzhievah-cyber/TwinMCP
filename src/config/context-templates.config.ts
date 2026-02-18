import { ContextTemplate } from '../types/context-assembly.types';

export const CONTEXT_TEMPLATES: Record<string, ContextTemplate> = {
  'gpt-4o-documentation': {
    id: 'gpt-4o-documentation',
    name: 'GPT-4o Documentation Template',
    targetModel: 'gpt-4o',
    maxTokens: 16000,
    sections: [
      {
        id: 'overview',
        name: 'Overview',
        type: 'dynamic',
        content: '{{overview}}',
        priority: 1,
        maxTokens: 500
      },
      {
        id: 'key-concepts',
        name: 'Key Concepts',
        type: 'dynamic',
        content: '{{keyConcepts}}',
        priority: 2,
        maxTokens: 1000
      },
      {
        id: 'api-reference',
        name: 'API Reference',
        type: 'conditional',
        content: '{{apiReference}}',
        priority: 3,
        maxTokens: 2000,
        conditions: ['includeApiReferences']
      },
      {
        id: 'code-examples',
        name: 'Code Examples',
        type: 'conditional',
        content: '{{codeExamples}}',
        priority: 4,
        maxTokens: 2500,
        conditions: ['includeCodeExamples']
      },
      {
        id: 'additional-info',
        name: 'Additional Information',
        type: 'dynamic',
        content: '{{additionalInfo}}',
        priority: 5,
        maxTokens: 2000
      }
    ],
    variables: [
      {
        name: 'userLevel',
        type: 'text',
        defaultValue: 'intermediate',
        description: 'User experience level'
      },
      {
        name: 'framework',
        type: 'text',
        defaultValue: '',
        description: 'Target framework'
      }
    ]
  },
  'claude-3-technical': {
    id: 'claude-3-technical',
    name: 'Claude-3 Technical Documentation',
    targetModel: 'claude-3',
    maxTokens: 100000,
    sections: [
      {
        id: 'introduction',
        name: 'Introduction',
        type: 'dynamic',
        content: '{{introduction}}',
        priority: 1,
        maxTokens: 800
      },
      {
        id: 'technical-details',
        name: 'Technical Details',
        type: 'dynamic',
        content: '{{technicalDetails}}',
        priority: 2,
        maxTokens: 3000
      },
      {
        id: 'implementation',
        name: 'Implementation',
        type: 'dynamic',
        content: '{{implementation}}',
        priority: 3,
        maxTokens: 4000
      },
      {
        id: 'best-practices',
        name: 'Best Practices',
        type: 'dynamic',
        content: '{{bestPractices}}',
        priority: 4,
        maxTokens: 2000
      }
    ],
    variables: []
  },
  'gpt-4o-mini-quick': {
    id: 'gpt-4o-mini-quick',
    name: 'GPT-4o Mini Quick Reference',
    targetModel: 'gpt-4o-mini',
    maxTokens: 8000,
    sections: [
      {
        id: 'summary',
        name: 'Summary',
        type: 'dynamic',
        content: '{{summary}}',
        priority: 1,
        maxTokens: 800
      },
      {
        id: 'essential-code',
        name: 'Essential Code',
        type: 'conditional',
        content: '{{essentialCode}}',
        priority: 2,
        maxTokens: 1500,
        conditions: ['includeCodeExamples']
      },
      {
        id: 'quick-api',
        name: 'Quick API Reference',
        type: 'conditional',
        content: '{{quickApi}}',
        priority: 3,
        maxTokens: 1200,
        conditions: ['includeApiReferences']
      },
      {
        id: 'usage-tips',
        name: 'Usage Tips',
        type: 'dynamic',
        content: '{{usageTips}}',
        priority: 4,
        maxTokens: 500
      }
    ],
    variables: [
      {
        name: 'userLevel',
        type: 'text',
        defaultValue: 'beginner',
        description: 'User experience level'
      }
    ]
  },
  'llama-2-detailed': {
    id: 'llama-2-detailed',
    name: 'LLaMA-2 Detailed Documentation',
    targetModel: 'llama-2',
    maxTokens: 6000,
    sections: [
      {
        id: 'context',
        name: 'Context and Background',
        type: 'dynamic',
        content: '{{context}}',
        priority: 1,
        maxTokens: 1000
      },
      {
        id: 'explanation',
        name: 'Detailed Explanation',
        type: 'dynamic',
        content: '{{explanation}}',
        priority: 2,
        maxTokens: 2000
      },
      {
        id: 'examples',
        name: 'Examples and Use Cases',
        type: 'conditional',
        content: '{{examples}}',
        priority: 3,
        maxTokens: 2000,
        conditions: ['includeCodeExamples']
      },
      {
        id: 'reference',
        name: 'Technical Reference',
        type: 'conditional',
        content: '{{reference}}',
        priority: 4,
        maxTokens: 1000,
        conditions: ['includeApiReferences']
      }
    ],
    variables: [
      {
        name: 'projectType',
        type: 'text',
        defaultValue: 'general',
        description: 'Type of project'
      }
    ]
  },
  'custom-minimal': {
    id: 'custom-minimal',
    name: 'Custom Minimal Template',
    targetModel: 'custom',
    maxTokens: 2000,
    sections: [
      {
        id: 'core',
        name: 'Core Information',
        type: 'dynamic',
        content: '{{core}}',
        priority: 1,
        maxTokens: 1500
      },
      {
        id: 'essentials',
        name: 'Essentials Only',
        type: 'dynamic',
        content: '{{essentials}}',
        priority: 2,
        maxTokens: 500
      }
    ],
    variables: [
      {
        name: 'focus',
        type: 'text',
        defaultValue: 'general',
        description: 'Focus area'
      }
    ]
  }
};

export function getTemplateForModel(model: string): ContextTemplate {
  const templateKey = `${model}-documentation`;
  return CONTEXT_TEMPLATES[templateKey] || CONTEXT_TEMPLATES['gpt-4o-documentation'];
}

export function getAllTemplates(): ContextTemplate[] {
  return Object.values(CONTEXT_TEMPLATES);
}

export function getTemplateById(id: string): ContextTemplate | undefined {
  return CONTEXT_TEMPLATES[id];
}
