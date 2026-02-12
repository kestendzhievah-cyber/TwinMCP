// Données des bibliothèques MCP pour les pages de détail
export interface MCPLibraryData {
  id: string;
  name: string;
  source: string;
  sourceType: 'github' | 'website';
  tokens: string;
  snippets: string;
  lastUpdate: string;
  isVerified: boolean;
  description: string;
  longDescription: string;
  version: string;
  language: string;
  license: string;
  stars: string;
  forks: string;
  contributors: number;
  categories: string[];
  features: string[];
  installation: string;
  usage: string;
  documentation: string;
  repository: string;
  examples: { title: string; code: string }[];
}

export const librariesData: Record<string, MCPLibraryData> = {
  '1': {
    id: '1',
    name: 'Next.js',
    source: '/vercel/next.js',
    sourceType: 'github',
    tokens: '572K',
    snippets: '2,1K',
    lastUpdate: '4 jours',
    isVerified: true,
    description: 'Framework React pour la production avec rendu hybride.',
    longDescription: 'Next.js est un framework React de production qui offre le rendu côté serveur (SSR), la génération de sites statiques (SSG), le routage basé sur les fichiers, et bien plus encore. Il est optimisé pour les performances et le SEO.',
    version: '14.1.0',
    language: 'TypeScript',
    license: 'MIT',
    stars: '120K+',
    forks: '26K+',
    contributors: 3200,
    categories: ['Framework', 'React', 'SSR', 'Full-stack'],
    features: [
      'App Router avec React Server Components',
      'Rendu hybride (SSR, SSG, ISR)',
      'Optimisation automatique des images',
      'API Routes intégrées',
      'Middleware Edge',
      'Support TypeScript natif',
    ],
    installation: 'npx create-next-app@latest',
    usage: `import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: 'Hello World' })
}`,
    documentation: 'https://nextjs.org/docs',
    repository: 'https://github.com/vercel/next.js',
    examples: [
      { title: 'Créer une page', code: 'Crée une page Next.js avec un formulaire de contact.' },
      { title: 'API Route', code: 'Crée une API Route pour gérer les utilisateurs.' },
    ],
  },
  '2': {
    id: '2',
    name: 'Better Auth',
    source: '/better-auth/better-auth',
    sourceType: 'github',
    tokens: '443K',
    snippets: '2,1K',
    lastUpdate: '2 jours',
    isVerified: true,
    description: 'Solution d\'authentification moderne et flexible pour applications web.',
    longDescription: 'Better Auth est une bibliothèque d\'authentification complète qui offre une solution simple et sécurisée pour gérer l\'authentification dans vos applications. Elle supporte OAuth, les sessions, les tokens JWT et plus encore.',
    version: '1.2.0',
    language: 'TypeScript',
    license: 'MIT',
    stars: '15K+',
    forks: '1.2K+',
    contributors: 89,
    categories: ['Auth', 'Security', 'OAuth', 'Sessions'],
    features: [
      'OAuth 2.0 (Google, GitHub, etc.)',
      'Sessions sécurisées',
      'Tokens JWT',
      'Protection CSRF',
      'Rate limiting intégré',
      'Support multi-tenant',
    ],
    installation: 'npm install better-auth',
    usage: `import { betterAuth } from 'better-auth'

const auth = betterAuth({
  providers: ['google', 'github'],
  session: { strategy: 'jwt' }
})`,
    documentation: 'https://better-auth.dev/docs',
    repository: 'https://github.com/better-auth/better-auth',
    examples: [
      { title: 'Configurer OAuth', code: 'Configure l\'authentification Google avec Better Auth.' },
      { title: 'Protéger une route', code: 'Protège une API route avec Better Auth.' },
    ],
  },
  '3': {
    id: '3',
    name: 'Claude Code',
    source: '/anthropics/claude-code',
    sourceType: 'github',
    tokens: '214K',
    snippets: '790',
    lastUpdate: '1 semaine',
    isVerified: true,
    description: 'SDK officiel pour intégrer Claude dans vos applications.',
    longDescription: 'Claude Code est le SDK officiel d\'Anthropic pour intégrer les capacités de Claude dans vos applications. Il offre une API simple et puissante pour la génération de texte, l\'analyse de code et l\'assistance IA.',
    version: '0.8.0',
    language: 'TypeScript',
    license: 'Apache-2.0',
    stars: '8K+',
    forks: '500+',
    contributors: 45,
    categories: ['AI', 'LLM', 'SDK', 'Anthropic'],
    features: [
      'Génération de texte avancée',
      'Analyse et génération de code',
      'Streaming de réponses',
      'Gestion du contexte',
      'Support des outils (function calling)',
      'Vision (analyse d\'images)',
    ],
    installation: 'npm install @anthropic-ai/sdk',
    usage: `import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()
const message = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello, Claude!' }]
})`,
    documentation: 'https://docs.anthropic.com',
    repository: 'https://github.com/anthropics/claude-code',
    examples: [
      { title: 'Chat simple', code: 'Crée un chatbot avec Claude.' },
      { title: 'Analyse de code', code: 'Utilise Claude pour analyser et améliorer du code.' },
    ],
  },
  '4': {
    id: '4',
    name: 'AI SDK',
    source: 'ai-sdk.dev',
    sourceType: 'website',
    tokens: '902K',
    snippets: '5,7K',
    lastUpdate: '6 jours',
    isVerified: true,
    description: 'SDK unifié pour intégrer l\'IA dans vos applications.',
    longDescription: 'AI SDK de Vercel est un toolkit complet pour construire des applications IA. Il fournit une interface unifiée pour travailler avec différents modèles de langage (OpenAI, Anthropic, Google, etc.) et des primitives React pour le streaming.',
    version: '3.0.0',
    language: 'TypeScript',
    license: 'Apache-2.0',
    stars: '25K+',
    forks: '3K+',
    contributors: 156,
    categories: ['AI', 'SDK', 'React', 'Streaming'],
    features: [
      'Support multi-providers (OpenAI, Anthropic, Google)',
      'Streaming UI avec React',
      'Generative UI',
      'Tool calling unifié',
      'Edge runtime compatible',
      'RAG helpers',
    ],
    installation: 'npm install ai',
    usage: `import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'

const { text } = await generateText({
  model: openai('gpt-4-turbo'),
  prompt: 'Explain quantum computing'
})`,
    documentation: 'https://sdk.vercel.ai/docs',
    repository: 'https://github.com/vercel/ai',
    examples: [
      { title: 'Chat streaming', code: 'Crée un chat avec streaming en temps réel.' },
      { title: 'Generative UI', code: 'Génère des composants React dynamiquement.' },
    ],
  },
  '5': {
    id: '5',
    name: 'Vercel AI SDK',
    source: '/vercel/ai',
    sourceType: 'github',
    tokens: '936K',
    snippets: '4,4K',
    lastUpdate: '14 heures',
    isVerified: true,
    description: 'Bibliothèque pour construire des applications IA avec React.',
    longDescription: 'Vercel AI SDK est la bibliothèque de référence pour construire des interfaces utilisateur alimentées par l\'IA. Elle offre des hooks React, des composants de streaming et une intégration transparente avec Next.js.',
    version: '3.1.0',
    language: 'TypeScript',
    license: 'Apache-2.0',
    stars: '25K+',
    forks: '3K+',
    contributors: 156,
    categories: ['AI', 'React', 'Next.js', 'Streaming'],
    features: [
      'useChat hook pour les chatbots',
      'useCompletion pour l\'autocomplétion',
      'Streaming SSE natif',
      'Support RSC (React Server Components)',
      'Intégration Next.js optimisée',
    ],
    installation: 'npm install ai @ai-sdk/openai',
    usage: `'use client'
import { useChat } from 'ai/react'

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat()
  return (
    <form onSubmit={handleSubmit}>
      {messages.map(m => <div key={m.id}>{m.content}</div>)}
      <input value={input} onChange={handleInputChange} />
    </form>
  )
}`,
    documentation: 'https://sdk.vercel.ai/docs',
    repository: 'https://github.com/vercel/ai',
    examples: [
      { title: 'Chatbot React', code: 'Crée un chatbot avec useChat.' },
      { title: 'Autocomplétion', code: 'Ajoute l\'autocomplétion IA à un champ texte.' },
    ],
  },
  '6': {
    id: '6',
    name: 'React',
    source: '/facebook/react',
    sourceType: 'github',
    tokens: '1,2M',
    snippets: '3,8K',
    lastUpdate: '3 jours',
    isVerified: true,
    description: 'Bibliothèque JavaScript pour construire des interfaces utilisateur.',
    longDescription: 'React est la bibliothèque JavaScript la plus populaire pour construire des interfaces utilisateur. Développée par Meta, elle utilise un DOM virtuel et un modèle de composants déclaratif pour créer des applications web performantes.',
    version: '18.2.0',
    language: 'JavaScript',
    license: 'MIT',
    stars: '220K+',
    forks: '45K+',
    contributors: 1600,
    categories: ['UI', 'Frontend', 'JavaScript', 'Components'],
    features: [
      'Virtual DOM performant',
      'Composants fonctionnels avec Hooks',
      'Server Components (React 19)',
      'Concurrent Mode',
      'Suspense pour le data fetching',
      'Écosystème riche',
    ],
    installation: 'npm install react react-dom',
    usage: `import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  )
}`,
    documentation: 'https://react.dev',
    repository: 'https://github.com/facebook/react',
    examples: [
      { title: 'Composant avec état', code: 'Crée un compteur avec useState.' },
      { title: 'Effet secondaire', code: 'Utilise useEffect pour fetch des données.' },
    ],
  },
};
