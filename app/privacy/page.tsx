'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Shield, Eye, Lock, Database, Cookie, Users, Globe, AlertCircle } from 'lucide-react';

export default function PrivacyPage() {
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
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Politique de Confidentialité
          </h1>
          <p className="text-gray-400 text-lg">
            Comment nous collectons, utilisons et protégeons vos données
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
              <Eye className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">1. Introduction</h2>
            </div>
            <p className="text-gray-300 leading-relaxed">
              Chez TwinMCP, nous prenons votre vie privée au sérieux. Cette Politique de Confidentialité explique 
              comment nous collectons, utilisons, partageons et protégeons vos informations personnelles lorsque 
              vous utilisez notre service. En utilisant TwinMCP, vous acceptez les pratiques décrites dans cette politique.
            </p>
          </section>

          {/* Data Collection */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">2. Données que Nous Collectons</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">2.1 Informations que Vous Fournissez</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Informations de compte :</strong> nom, adresse email, mot de passe (chiffré)</li>
                  <li><strong>Informations de paiement :</strong> traitées par nos prestataires de paiement tiers (Stripe)</li>
                  <li><strong>Contenu utilisateur :</strong> bibliothèques indexées, configurations MCP, préférences</li>
                  <li><strong>Communications :</strong> messages que vous nous envoyez via le support ou email</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">2.2 Informations Collectées Automatiquement</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Données d'utilisation :</strong> pages visitées, fonctionnalités utilisées, temps passé</li>
                  <li><strong>Données techniques :</strong> adresse IP, type de navigateur, système d'exploitation, appareil</li>
                  <li><strong>Logs API :</strong> requêtes effectuées, clés API utilisées, timestamps, codes de réponse</li>
                  <li><strong>Cookies et technologies similaires :</strong> pour améliorer votre expérience</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">2.3 Données Tierces</h3>
                <p>
                  Lorsque vous connectez des services tiers (GitHub, GitLab, etc.), nous collectons les informations 
                  nécessaires pour fournir le service, comme les URLs de dépôts et les métadonnées de documentation.
                </p>
              </div>
            </div>
          </section>

          {/* Data Usage */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Comment Nous Utilisons Vos Données</h2>
            <div className="space-y-4 text-gray-300">
              <p>Nous utilisons vos informations pour :</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Fournir le service :</strong> indexer la documentation, traiter les requêtes API, gérer votre compte</li>
                <li><strong>Améliorer le service :</strong> analyser l'utilisation, identifier les bugs, développer de nouvelles fonctionnalités</li>
                <li><strong>Communication :</strong> vous envoyer des notifications importantes, répondre à vos demandes de support</li>
                <li><strong>Sécurité :</strong> détecter et prévenir la fraude, les abus et les violations de sécurité</li>
                <li><strong>Conformité légale :</strong> respecter nos obligations légales et réglementaires</li>
                <li><strong>Marketing :</strong> vous informer de nouvelles fonctionnalités (avec votre consentement)</li>
              </ul>
            </div>
          </section>

          {/* Data Sharing */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">4. Partage de Vos Données</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p>Nous ne vendons jamais vos données personnelles. Nous pouvons partager vos informations avec :</p>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">4.1 Prestataires de Services</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Hébergement :</strong> Firebase, Google Cloud Platform</li>
                  <li><strong>Paiement :</strong> Stripe (pour traiter les paiements)</li>
                  <li><strong>Analytics :</strong> services d'analyse anonymisée</li>
                  <li><strong>Support :</strong> outils de support client</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">4.2 Obligations Légales</h3>
                <p>
                  Nous pouvons divulguer vos informations si la loi l'exige, en réponse à une procédure judiciaire, 
                  ou pour protéger nos droits, votre sécurité ou celle d'autrui.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">4.3 Transferts d'Entreprise</h3>
                <p>
                  En cas de fusion, acquisition ou vente d'actifs, vos informations peuvent être transférées. 
                  Nous vous informerons de tout changement de propriété.
                </p>
              </div>
            </div>
          </section>

          {/* Cookies */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Cookie className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">5. Cookies et Technologies de Suivi</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p>Nous utilisons des cookies et technologies similaires pour :</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Cookies essentiels :</strong> nécessaires au fonctionnement du service (authentification, sécurité)</li>
                <li><strong>Cookies de performance :</strong> pour analyser l'utilisation et améliorer le service</li>
                <li><strong>Cookies de préférence :</strong> pour mémoriser vos paramètres et préférences</li>
              </ul>
              <p className="mt-4">
                Vous pouvez gérer vos préférences de cookies via les paramètres de votre navigateur. Notez que 
                désactiver certains cookies peut affecter le fonctionnement du service.
              </p>
            </div>
          </section>

          {/* Data Security */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Lock className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">6. Sécurité des Données</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p>Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles pour protéger vos données :</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Chiffrement :</strong> TLS/SSL pour les données en transit, chiffrement au repos pour les données sensibles</li>
                <li><strong>Contrôle d'accès :</strong> accès limité aux données personnelles sur la base du besoin de savoir</li>
                <li><strong>Surveillance :</strong> détection et réponse aux incidents de sécurité</li>
                <li><strong>Audits :</strong> évaluations régulières de nos pratiques de sécurité</li>
              </ul>
              <p className="mt-4">
                Cependant, aucune méthode de transmission sur Internet n'est 100% sécurisée. Nous ne pouvons 
                garantir la sécurité absolue de vos informations.
              </p>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Conservation des Données</h2>
            <div className="space-y-4 text-gray-300">
              <p>Nous conservons vos données personnelles aussi longtemps que nécessaire pour :</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Fournir le service et maintenir votre compte</li>
                <li>Respecter nos obligations légales et réglementaires</li>
                <li>Résoudre les litiges et faire respecter nos accords</li>
              </ul>
              <p className="mt-4">
                Après la suppression de votre compte, nous conservons certaines données pendant 30 jours pour 
                permettre une récupération en cas d'erreur. Après ce délai, vos données sont définitivement supprimées, 
                sauf obligation légale de conservation.
              </p>
            </div>
          </section>

          {/* Your Rights */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">8. Vos Droits (RGPD)</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p>Conformément au RGPD, vous disposez des droits suivants :</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Droit d'accès :</strong> obtenir une copie de vos données personnelles</li>
                <li><strong>Droit de rectification :</strong> corriger les données inexactes ou incomplètes</li>
                <li><strong>Droit à l'effacement :</strong> demander la suppression de vos données ("droit à l'oubli")</li>
                <li><strong>Droit à la limitation :</strong> restreindre le traitement de vos données</li>
                <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré</li>
                <li><strong>Droit d'opposition :</strong> vous opposer au traitement de vos données</li>
                <li><strong>Droit de retrait du consentement :</strong> retirer votre consentement à tout moment</li>
              </ul>
              <p className="mt-4">
                Pour exercer ces droits, contactez-nous à <strong className="text-purple-300">privacy@twinmcp.com</strong>. 
                Nous répondrons à votre demande dans un délai de 30 jours.
              </p>
            </div>
          </section>

          {/* International Transfers */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Transferts Internationaux</h2>
            <div className="space-y-4 text-gray-300">
              <p>
                Vos données peuvent être transférées et traitées dans des pays en dehors de l'Union Européenne, 
                notamment aux États-Unis (serveurs Google Cloud Platform, Firebase).
              </p>
              <p>
                Nous nous assurons que ces transferts sont effectués conformément au RGPD, en utilisant des 
                mécanismes appropriés tels que les clauses contractuelles types de l'UE.
              </p>
            </div>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Protection des Mineurs</h2>
            <p className="text-gray-300 leading-relaxed">
              TwinMCP n'est pas destiné aux personnes de moins de 16 ans. Nous ne collectons pas sciemment 
              d'informations personnelles auprès de mineurs. Si vous pensez qu'un mineur nous a fourni des 
              informations personnelles, contactez-nous immédiatement.
            </p>
          </section>

          {/* Third-Party Links */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Liens Tiers</h2>
            <p className="text-gray-300 leading-relaxed">
              Notre service peut contenir des liens vers des sites web tiers. Nous ne sommes pas responsables 
              des pratiques de confidentialité de ces sites. Nous vous encourageons à lire leurs politiques de 
              confidentialité.
            </p>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. Modifications de cette Politique</h2>
            <p className="text-gray-300 leading-relaxed">
              Nous pouvons mettre à jour cette Politique de Confidentialité de temps en temps. Les modifications 
              importantes seront notifiées par email ou via une notification dans le service au moins 30 jours 
              avant leur entrée en vigueur. La date de "Dernière mise à jour" en haut de cette page indique 
              quand la politique a été révisée pour la dernière fois.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">13. Nous Contacter</h2>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6">
              <p className="text-gray-300 mb-4">
                Pour toute question concernant cette Politique de Confidentialité ou vos données personnelles :
              </p>
              <ul className="space-y-2 text-gray-300">
                <li><strong className="text-purple-300">Email :</strong> privacy@twinmcp.com</li>
                <li><strong className="text-purple-300">DPO :</strong> dpo@twinmcp.com</li>
                <li><strong className="text-purple-300">Support :</strong> support@twinmcp.com</li>
                <li><strong className="text-purple-300">Adresse :</strong> TwinMCP Team, Paris, France</li>
              </ul>
              <p className="text-gray-300 mt-4">
                Vous avez également le droit de déposer une plainte auprès de la CNIL (Commission Nationale 
                de l'Informatique et des Libertés) si vous estimez que vos droits n'ont pas été respectés.
              </p>
            </div>
          </section>

          {/* Notice */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-6 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-amber-300 mb-2">Important</h3>
              <p className="text-gray-300">
                En utilisant TwinMCP, vous acceptez cette Politique de Confidentialité ainsi que nos 
                <Link href="/terms" className="text-purple-400 hover:text-purple-300 underline mx-1">
                  Conditions d'utilisation
                </Link>
                et notre
                <Link href="/addendum" className="text-purple-400 hover:text-purple-300 underline mx-1">
                  Addendum TwinMCP
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
          <Link href="/addendum" className="text-gray-400 hover:text-white transition">
            Addendum TwinMCP
          </Link>
          <Link href="/contact" className="text-gray-400 hover:text-white transition">
            Contact
          </Link>
        </div>
      </div>
    </div>
  );
}
