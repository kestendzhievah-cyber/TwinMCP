'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, FileText, Scale, Users, Shield, AlertCircle } from 'lucide-react';

export default function TermsPage() {
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
            <Scale className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Conditions d'Utilisation
          </h1>
          <p className="text-gray-400 text-lg">
            Conditions générales d'utilisation de TwinMCP
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Dernière mise à jour : 26 janvier 2026
          </p>
        </div>

        {/* Content Card */}
        <div className="bg-slate-800/50 backdrop-blur border border-purple-500/20 rounded-2xl p-8 space-y-8">
          {/* Acceptance */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">1. Acceptation des Conditions</h2>
            </div>
            <p className="text-gray-300 leading-relaxed">
              En accédant et en utilisant TwinMCP (ci-après "le Service"), vous acceptez d'être lié par les présentes 
              Conditions d'Utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser le Service. 
              Nous nous réservons le droit de modifier ces conditions à tout moment, et votre utilisation continue 
              du Service constitue votre acceptation de ces modifications.
            </p>
          </section>

          {/* Service Description */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Description du Service</h2>
            <div className="space-y-3 text-gray-300">
              <p>
                TwinMCP est une plateforme qui fournit un accès à la documentation de bibliothèques de code 
                via le protocole MCP (Model Context Protocol) pour les LLMs et éditeurs de code IA.
              </p>
              <p>Le Service comprend :</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Indexation automatique de documentation depuis GitHub, GitLab, Bitbucket et sites web</li>
                <li>API MCP pour l'intégration avec des éditeurs de code (Cursor, VS Code, Claude Code, etc.)</li>
                <li>Recherche intelligente dans la documentation</li>
                <li>Gestion de versions multiples de bibliothèques</li>
                <li>Synchronisation automatique des mises à jour</li>
              </ul>
            </div>
          </section>

          {/* Account */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">3. Compte Utilisateur</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">3.1 Création de Compte</h3>
                <p>
                  Pour utiliser certaines fonctionnalités du Service, vous devez créer un compte. Vous vous engagez 
                  à fournir des informations exactes, complètes et à jour lors de l'inscription.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">3.2 Sécurité du Compte</h3>
                <p>
                  Vous êtes responsable de la confidentialité de votre mot de passe et de toutes les activités 
                  effectuées sous votre compte. Vous devez nous informer immédiatement de toute utilisation non 
                  autorisée de votre compte.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">3.3 Suspension de Compte</h3>
                <p>
                  Nous nous réservons le droit de suspendre ou de résilier votre compte en cas de violation des 
                  présentes conditions, d'activité frauduleuse ou de comportement abusif.
                </p>
              </div>
            </div>
          </section>

          {/* Usage Rules */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white">4. Règles d'Utilisation</h2>
            </div>
            <div className="space-y-4 text-gray-300">
              <p>En utilisant le Service, vous vous engagez à :</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Respecter toutes les lois et réglementations applicables</li>
                <li>Ne pas utiliser le Service à des fins illégales ou non autorisées</li>
                <li>Ne pas tenter de contourner les mesures de sécurité ou les limitations techniques</li>
                <li>Ne pas surcharger ou perturber le fonctionnement du Service</li>
                <li>Ne pas collecter ou extraire des données du Service par des moyens automatisés non autorisés</li>
                <li>Ne pas usurper l'identité d'une autre personne ou entité</li>
                <li>Ne pas transmettre de virus, malware ou tout code malveillant</li>
                <li>Respecter les droits de propriété intellectuelle de TwinMCP et des tiers</li>
              </ul>
            </div>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Propriété Intellectuelle</h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">5.1 Propriété de TwinMCP</h3>
                <p>
                  Le Service, y compris son code source, son design, sa structure et tous les contenus associés, 
                  est la propriété exclusive de TwinMCP et est protégé par les lois sur la propriété intellectuelle.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">5.2 Contenu Utilisateur</h3>
                <p>
                  Vous conservez tous les droits sur les bibliothèques et documentations que vous indexez via le Service. 
                  En utilisant le Service, vous nous accordez une licence limitée pour stocker, traiter et afficher 
                  ce contenu uniquement dans le but de fournir le Service.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">5.3 Contenu Tiers</h3>
                <p>
                  La documentation indexée provient de sources tierces (GitHub, sites web, etc.). Nous ne revendiquons 
                  aucun droit sur ce contenu et vous êtes responsable de respecter les licences et conditions 
                  d'utilisation des bibliothèques que vous indexez.
                </p>
              </div>
            </div>
          </section>

          {/* Subscription */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Abonnements et Paiements</h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">6.1 Plans Gratuits et Payants</h3>
                <p>
                  TwinMCP propose des plans gratuits et payants. Les fonctionnalités disponibles varient selon 
                  le plan choisi. Les prix et fonctionnalités sont indiqués sur notre page de tarification.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">6.2 Facturation</h3>
                <p>
                  Les abonnements payants sont facturés mensuellement ou annuellement selon votre choix. 
                  Les paiements sont traités de manière sécurisée via nos prestataires de paiement tiers.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">6.3 Renouvellement Automatique</h3>
                <p>
                  Votre abonnement se renouvelle automatiquement à la fin de chaque période de facturation, 
                  sauf si vous l'annulez avant la date de renouvellement.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">6.4 Remboursements</h3>
                <p>
                  Les paiements ne sont généralement pas remboursables, sauf en cas d'erreur de facturation ou 
                  si la loi applicable l'exige. Contactez notre support pour toute demande de remboursement.
                </p>
              </div>
            </div>
          </section>

          {/* Privacy */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Confidentialité et Données</h2>
            <div className="space-y-4 text-gray-300">
              <p>
                Votre vie privée est importante pour nous. Notre collecte et utilisation de vos données personnelles 
                sont régies par notre 
                <Link href="/privacy" className="text-purple-400 hover:text-purple-300 underline mx-1">
                  Politique de Confidentialité
                </Link>.
              </p>
              <p>
                En utilisant le Service, vous consentez à la collecte et à l'utilisation de vos informations 
                conformément à notre Politique de Confidentialité.
              </p>
            </div>
          </section>

          {/* Disclaimers */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Exclusions de Garantie</h2>
            <div className="space-y-4 text-gray-300">
              <p>
                LE SERVICE EST FOURNI "TEL QUEL" ET "SELON DISPONIBILITÉ", SANS GARANTIE D'AUCUNE SORTE, 
                EXPRESSE OU IMPLICITE, Y COMPRIS, MAIS SANS S'Y LIMITER, LES GARANTIES IMPLICITES DE 
                QUALITÉ MARCHANDE, D'ADÉQUATION À UN USAGE PARTICULIER ET DE NON-CONTREFAÇON.
              </p>
              <p>
                Nous ne garantissons pas que le Service sera ininterrompu, sécurisé ou exempt d'erreurs. 
                Nous ne garantissons pas l'exactitude, l'exhaustivité ou l'actualité de la documentation indexée.
              </p>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Limitation de Responsabilité</h2>
            <div className="space-y-4 text-gray-300">
              <p>
                DANS TOUTE LA MESURE PERMISE PAR LA LOI, TWINMCP, SES DIRIGEANTS, EMPLOYÉS ET PARTENAIRES 
                NE SERONT PAS RESPONSABLES DES DOMMAGES INDIRECTS, ACCESSOIRES, SPÉCIAUX, CONSÉCUTIFS OU 
                PUNITIFS, Y COMPRIS, MAIS SANS S'Y LIMITER, LA PERTE DE PROFITS, DE DONNÉES, D'UTILISATION 
                OU AUTRES PERTES INTANGIBLES.
              </p>
              <p>
                Notre responsabilité totale envers vous pour toute réclamation découlant de ou liée à ces 
                conditions ou au Service ne dépassera pas le montant que vous avez payé à TwinMCP au cours 
                des 12 mois précédant la réclamation.
              </p>
            </div>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Résiliation</h2>
            <div className="space-y-4 text-gray-300">
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">10.1 Par Vous</h3>
                <p>
                  Vous pouvez résilier votre compte à tout moment en nous contactant ou via les paramètres 
                  de votre compte. La résiliation prendra effet à la fin de votre période de facturation en cours.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">10.2 Par TwinMCP</h3>
                <p>
                  Nous pouvons suspendre ou résilier votre accès au Service immédiatement, sans préavis, 
                  en cas de violation des présentes conditions ou pour toute autre raison légitime.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-300 mb-2">10.3 Effets de la Résiliation</h3>
                <p>
                  Après la résiliation, votre droit d'utiliser le Service cessera immédiatement. Nous pouvons 
                  supprimer vos données après un délai de grâce de 30 jours, sauf obligation légale de conservation.
                </p>
              </div>
            </div>
          </section>

          {/* Changes */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Modifications des Conditions</h2>
            <p className="text-gray-300 leading-relaxed">
              Nous nous réservons le droit de modifier ces Conditions d'Utilisation à tout moment. Les modifications 
              importantes seront notifiées par email ou via une notification dans le Service au moins 30 jours avant 
              leur entrée en vigueur. Votre utilisation continue du Service après l'entrée en vigueur des modifications 
              constitue votre acceptation des nouvelles conditions.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. Droit Applicable</h2>
            <p className="text-gray-300 leading-relaxed">
              Ces Conditions d'Utilisation sont régies par les lois françaises, sans égard aux principes de conflits 
              de lois. Tout litige découlant de ou lié à ces conditions sera soumis à la juridiction exclusive des 
              tribunaux de Paris, France.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">13. Contact</h2>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6">
              <p className="text-gray-300 mb-4">
                Pour toute question concernant ces Conditions d'Utilisation, contactez-nous :
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
                En utilisant TwinMCP, vous acceptez ces Conditions d'Utilisation ainsi que notre 
                <Link href="/privacy" className="text-purple-400 hover:text-purple-300 underline mx-1">
                  Politique de confidentialité
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
          <Link href="/privacy" className="text-gray-400 hover:text-white transition">
            Politique de confidentialité
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
