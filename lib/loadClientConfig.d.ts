/**
 * Charge la configuration d'un client depuis la base de données.
 * @param clientName Le nom du client à charger.
 * @param environment L'environnement (dev, staging, prod) - défaut : DEVELOPMENT.
 * @returns Un objet contenant les données du client, y compris les clés API, paramètres, modules actifs et variables d'environnement.
 */
export declare function loadClientConfig(clientName: string, environment?: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION'): Promise<{
    name: string;
    domain: string;
    apiKeys: {};
    settings: {};
    modules: never[];
    environmentVariables: {};
}>;
//# sourceMappingURL=loadClientConfig.d.ts.map