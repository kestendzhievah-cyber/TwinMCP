"use strict";
'use client';
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Optimize;
const react_1 = require("react");
const card_1 = require("../../components/ui/card");
const button_1 = require("../../components/ui/button");
function Optimize() {
    const [metrics, setMetrics] = (0, react_1.useState)({
        latency: '',
        cost: '',
        satisfaction: ''
    });
    const [suggestions, setSuggestions] = (0, react_1.useState)([]);
    const [isAnalyzing, setIsAnalyzing] = (0, react_1.useState)(false);
    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        // Simulate AI analysis
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Mock suggestions based on input
        const mockSuggestions = [
            {
                id: '1',
                title: 'Optimiser les prompts',
                description: 'Vos prompts peuvent être simplifiés pour réduire les coûts de 15%',
                impact: 'medium',
                effort: 'low'
            },
            {
                id: '2',
                title: 'Utiliser un modèle plus petit',
                description: 'Passer de Gemini Pro à Gemini Nano pourrait réduire la latence de 30%',
                impact: 'high',
                effort: 'medium'
            },
            {
                id: '3',
                title: 'Implémenter le cache',
                description: 'Ajouter un système de cache pour les réponses fréquentes',
                impact: 'high',
                effort: 'high'
            }
        ];
        setSuggestions(mockSuggestions);
        setIsAnalyzing(false);
    };
    const handleChange = (e) => {
        setMetrics(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };
    const getImpactColor = (impact) => {
        switch (impact) {
            case 'high': return 'text-red-600';
            case 'medium': return 'text-yellow-600';
            case 'low': return 'text-green-600';
            default: return 'text-gray-600';
        }
    };
    const getEffortColor = (effort) => {
        switch (effort) {
            case 'high': return 'text-red-600';
            case 'medium': return 'text-yellow-600';
            case 'low': return 'text-green-600';
            default: return 'text-gray-600';
        }
    };
    return (<div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Optimisation des performances</h1>
        <p className="mt-2 text-gray-600">
          Analysez et optimisez les performances de vos agents IA.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Input Metrics */}
        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Métriques actuelles</card_1.CardTitle>
            <card_1.CardDescription>
              Entrez les métriques de performance de votre agent
            </card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent className="space-y-4">
            <div>
              <label htmlFor="latency" className="block text-sm font-medium text-gray-700 mb-2">
                Latence moyenne (ms)
              </label>
              <input type="number" id="latency" name="latency" value={metrics.latency} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 1500"/>
            </div>

            <div>
              <label htmlFor="cost" className="block text-sm font-medium text-gray-700 mb-2">
                Coût mensuel (€)
              </label>
              <input type="number" id="cost" name="cost" value={metrics.cost} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 45.50"/>
            </div>

            <div>
              <label htmlFor="satisfaction" className="block text-sm font-medium text-gray-700 mb-2">
                Score de satisfaction (1-10)
              </label>
              <input type="number" id="satisfaction" name="satisfaction" value={metrics.satisfaction} onChange={handleChange} min="1" max="10" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 8"/>
            </div>

            <button_1.Button onClick={handleAnalyze} className="w-full" disabled={isAnalyzing}>
              {isAnalyzing ? 'Analyse en cours...' : 'Analyser et optimiser'}
            </button_1.Button>
          </card_1.CardContent>
        </card_1.Card>

        {/* Suggestions */}
        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Suggestions d&apos;optimisation</card_1.CardTitle>
            <card_1.CardDescription>
              Recommandations basées sur l&apos;analyse IA
            </card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            {suggestions.length === 0 ? (<div className="text-center text-gray-500 py-8">
                <p>Entrez vos métriques et lancez l&apos;analyse pour voir les suggestions</p>
              </div>) : (<div className="space-y-4">
                {suggestions.map((suggestion) => (<div key={suggestion.id} className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">{suggestion.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>
                    <div className="flex justify-between text-sm">
                      <span className={getImpactColor(suggestion.impact)}>
                        Impact: {suggestion.impact}
                      </span>
                      <span className={getEffortColor(suggestion.effort)}>
                        Effort: {suggestion.effort}
                      </span>
                    </div>
                  </div>))}
              </div>)}
          </card_1.CardContent>
        </card_1.Card>
      </div>

      {/* Current Performance */}
      {Object.values(metrics).some(value => value !== '') && (<card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle>Performance actuelle</card_1.CardTitle>
            <card_1.CardDescription>
              Résumé des métriques saisies
            </card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {metrics.latency || '—'}ms
                </div>
                <div className="text-sm text-gray-600">Latence</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  €{metrics.cost || '—'}
                </div>
                <div className="text-sm text-gray-600">Coût mensuel</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {metrics.satisfaction || '—'}/10
                </div>
                <div className="text-sm text-gray-600">Satisfaction</div>
              </div>
            </div>
          </card_1.CardContent>
        </card_1.Card>)}
    </div>);
}
//# sourceMappingURL=page.jsx.map