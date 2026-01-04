import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Features() {
  const features = [
    {
      title: 'Modèles de langage avancés',
      description: 'Intégration avec les derniers modèles de langage comme Gemini pour des performances optimales.',
      icon: '🤖'
    },
    {
      title: 'Outils externes via MCP',
      description: 'Connectez votre agent à des outils externes (Email, GitHub, Slack, etc.) grâce au protocole MCP.',
      icon: '🔗'
    },
    {
      title: 'Interface de chat intuitive',
      description: 'Une interface familière de type chatbot pour interagir naturellement avec vos agents.',
      icon: '💬'
    },
    {
      title: 'Optimisation automatique',
      description: 'Analysez et optimisez les performances de vos agents avec des suggestions basées sur l\'IA.',
      icon: '⚡'
    },
    {
      title: 'Gestion des coûts',
      description: 'Surveillez et contrôlez les coûts d\'utilisation de vos agents en temps réel.',
      icon: '💰'
    },
    {
      title: 'Sécurité et confidentialité',
      description: 'Vos données sont sécurisées avec l\'infrastructure Firebase et le chiffrement de bout en bout.',
      icon: '🔒'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Fonctionnalités puissantes
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Découvrez comment Corel.IA révolutionne la création et la gestion d&apos;agents IA personnalisés.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="h-full">
              <CardHeader>
                <div className="text-4xl mb-2">{feature.icon}</div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Prêt à commencer ?
            </h2>
            <p className="text-gray-600 mb-6">
              Créez votre premier agent IA en quelques minutes seulement.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/signup"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Commencer maintenant
              </a>
              <a
                href="/contact"
                className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Nous contacter
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
