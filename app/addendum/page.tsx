'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, FileText, Shield, AlertCircle } from 'lucide-react';

export default function AddendumPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-purple-500/20 bg-slate-900/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-purple-400" />
              <span className="text-2xl font-bold text-white">TwinMCP</span>
            </Link>
            <Link 
              href="/"
              className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Retour</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl mb-6">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Addendum TwinMCP
          </h1>
          <p className="text-gray-400 text-lg">
            Conditions spécifiques d'utilisation du service TwinMCP
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Dernière mise à jour : 26 janvier 2026
          </p>
        </div>

        {/* Content Card */}
        <div className="bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-2xl p-8 space-y-8">
          {/* Introduction */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">1. Introduction</h2>
            </div>
            <p className="text-gray-300 leading-relaxed">
              Le présent Addendum complète nos Conditions d'utilisation générales et notre Politique de confidentialité. 
              Il définit les conditions spécifiques applicables à l'utilisation de TwinMCP, notre plateforme de documentation 
              pour LLMs et éditeurs de code IA.
            </p>
          </section>

          {/* Service Description */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Description du Service</h2>
            <div className="space-y-3 text-gray-300">
              <p>TwinMCP fournit :</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Indexation et synchronisation de dépôts de documentation</li>
                <li>Accès à la documentation via API MCP (Model Context Protocol)</li>
                <li>Intégration avec des éditeurs de code IA (Cursor, Claude Code, VS Code, etc.)</li>
                <li>Recherche intelligente dans la documentation</li>
                <li>Gestion de versions multiples de bibliothèques</li>
              </ul>
            </div>
          </section>

          {/* Usage Rights */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Droits d'Utilisation</h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">3.1 Licence d'Utilisation</h3>
                <p>
                  Nous vous accordons une licence non exclusive, non transférable et révocable pour accéder et utiliser 
                  TwinMCP conformément aux présentes conditions et au plan d'abonnement choisi.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">3.2 Restrictions</h3>
                <p>Vous vous engagez à ne pas :</p>
                <ul className="list-disc list-inside space-y-2 ml-4 mt-2">
                  <li>Revendre, louer ou sous-licencier l'accès au service</li>
                  <li>Utiliser le service pour des activités illégales ou non autorisées</li>
                  <li>Tenter de contourner les limitations de votre plan d'abonnement</li>
                  <li>Effectuer du reverse engineering ou extraire le code source</li>
                  <li>Surcharger intentionnellement nos serveurs (DDoS, spam, etc.)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* API Usage */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Utilisation de l'API</h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">4.1 Limites de Requêtes</h3>
                <p>
                  Les limites de requêtes varient selon votre plan d'abonnement. Le dépassement des limites peut 
                  entraîner une limitation temporaire ou des frais supplémentaires.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">4.2 Clés API</h3>
                <p>
                  Vous êtes responsable de la sécurité de vos clés API. Ne les partagez jamais publiquement. 
                  En cas de compromission, révoquez immédiatement les clés concernées.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">4.3 Disponibilité</h3>
                <p>
                  Nous visons une disponibilité de 99,9% mais ne garantissons pas un service ininterrompu. 
                  Des maintenances planifiées seront annoncées à l'avance.
                </p>
              </div>
            </div>
          </section>

          {/* Data and Privacy */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Données et Confidentialité</h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">5.1 Données Indexées</h3>
                <p>
                  Les bibliothèques et documentations que vous indexez restent votre propriété. Nous les stockons 
                  uniquement pour fournir le service et ne les utilisons pas à d'autres fins.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">5.2 Données d'Utilisation</h3>
                <p>
                  Nous collectons des données d'utilisation anonymisées (requêtes, performances, erreurs) pour 
                  améliorer le service. Ces données ne contiennent pas d'informations personnelles identifiables.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">5.3 Conformité RGPD</h3>
                <p>
                  Nous respectons le RGPD. Vous disposez d'un droit d'accès, de rectification et de suppression 
                  de vos données personnelles. Contactez-nous à privacy@twinmcp.com pour exercer ces droits.
                </p>
              </div>
            </div>
          </section>

          {/* Billing */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Facturation et Paiement</h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">6.1 Plans d'Abonnement</h3>
                <p>
                  Les plans sont facturés mensuellement ou annuellement selon votre choix. Les prix sont indiqués 
                  hors taxes et peuvent être modifiés avec un préavis de 30 jours.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">6.2 Résiliation</h3>
                <p>
                  Vous pouvez résilier votre abonnement à tout moment. Aucun remboursement n'est effectué pour 
                  la période en cours. L'accès reste actif jusqu'à la fin de la période payée.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">6.3 Retard de Paiement</h3>
                <p>
                  En cas de retard de paiement, votre accès peut être suspendu après 7 jours. Les données sont 
                  conservées pendant 30 jours supplémentaires avant suppression définitive.
                </p>
              </div>
            </div>
          </section>

          {/* Liability */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Responsabilité</h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">7.1 Limitation de Responsabilité</h3>
                <p>
                  TwinMCP est fourni "tel quel". Nous ne garantissons pas l'exactitude ou l'exhaustivité de la 
                  documentation indexée. Notre responsabilité est limitée au montant payé au cours des 12 derniers mois.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">7.2 Indemnisation</h3>
                <p>
                  Vous acceptez de nous indemniser contre toute réclamation résultant de votre utilisation du service 
                  en violation des présentes conditions.
                </p>
              </div>
            </div>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Modifications</h2>
            <p className="text-gray-300 leading-relaxed">
              Nous nous réservons le droit de modifier cet Addendum à tout moment. Les modifications importantes 
              seront notifiées par email 30 jours avant leur entrée en vigueur. L'utilisation continue du service 
              après modification vaut acceptation des nouvelles conditions.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Contact</h2>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6">
              <p className="text-gray-300 mb-4">
                Pour toute question concernant cet Addendum, contactez-nous :
              </p>
              <ul className="space-y-2 text-gray-300">
                <li><strong className="text-purple-300">Email :</strong> legal@twinmcp.com</li>
                <li><strong className="text-purple-300">Support :</strong> support@twinmcp.com</li>
                <li><strong className="text-purple-300">Adresse :</strong> TwinMCP Team, Paris, France</li>
              </ul>
            </div>
          </section>

          {/* Notice */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-amber-300 mb-2">Important</h3>
              <p className="text-gray-300">
                En utilisant TwinMCP, vous acceptez les termes de cet Addendum ainsi que nos 
                <Link href="/terms" className="text-purple-400 hover:text-purple-300 underline mx-1">
                  Conditions d'utilisation
                </Link>
                et notre
                <Link href="/privacy" className="text-purple-400 hover:text-purple-300 underline mx-1">
                  Politique de confidentialité
                </Link>.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-8 flex justify-center gap-6 text-sm">
          <Link href="/terms" className="text-gray-400 hover:text-white transition">
            Conditions d'utilisation
          </Link>
          <Link href="/privacy" className="text-gray-400 hover:text-white transition">
            Politique de confidentialité
          </Link>
          <Link href="/contact" className="text-gray-400 hover:text-white transition">
            Contact
          </Link>
        </div>
      </div>
    </div>
  );
}
