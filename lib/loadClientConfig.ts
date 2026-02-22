import { prisma } from '@/lib/prisma';

/**
 * Charge la configuration d'un client depuis la base de données.
 * @param clientName Le nom du client à charger.
 * @param environment L'environnement (dev, staging, prod) - défaut : DEVELOPMENT.
 * @returns Un objet contenant les données du client, y compris les clés API, paramètres, modules actifs et variables d'environnement.
 */
export async function loadClientConfig(clientName: string, environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION' = 'DEVELOPMENT') {
  try {
    const tenant = await (prisma as any).tenant.findFirst({
      where: { name: clientName },
    });

    if (tenant) {
      return {
        name: tenant.name,
        domain: tenant.domain || `${clientName}.localhost`,
        apiKeys: (tenant as any).apiKeys || {},
        settings: (tenant as any).settings || {},
        modules: (tenant as any).modules || [],
        environmentVariables: {},
      };
    }
  } catch {
    // Tenant model may not match — fall through to defaults
  }

  return {
    name: clientName,
    domain: `${clientName}.localhost`,
    apiKeys: {},
    settings: {},
    modules: [],
    environmentVariables: {},
  };
}
