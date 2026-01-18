// Types globaux pour l'application

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
      apiKeyData?: {
        id: string;
        userId: string;
        keyPrefix: string;
        quotaRequestsPerMinute: number;
        quotaRequestsPerDay: number;
      };
    }
  }

  interface Request {
    query: Record<string, string | string[] | undefined>;
    params: Record<string, string>;
    body: any;
    headers: Record<string, string>;
    method: string;
    url: string;
  }

  interface Response {
    status(code: number): Response;
    json(data: any): Response;
    send(data: any): Response;
    end(): Response;
  }

  type NextFunction = (err?: any) => void;
}

export {};
