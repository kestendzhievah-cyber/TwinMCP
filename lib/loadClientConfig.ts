/**
 * Charge la configuration d'un client depuis la base de données.
 * @param clientName Le nom du client à charger.
 * @param environment L'environnement (dev, staging, prod) - défaut : DEVELOPMENT.
 * @returns Un objet contenant les données du client, y compris les clés API, paramètres, modules actifs et variables d'environnement.
 */
export async function loadClientConfig(clientName: string, environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION' = 'DEVELOPMENT') {
  // Temporairement retourner une configuration mockée
  // TODO: Implémenter avec le vrai client Prisma quand il sera disponible
  return {
    name: clientName,
    domain: `${clientName}.localhost`,
    apiKeys: {},
    settings: {},
    modules: [],
    environmentVariables: {},
  };
}
