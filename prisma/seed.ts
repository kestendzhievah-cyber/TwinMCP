import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Créer les modules de base s'ils n'existent pas
  const bookingModule = await prisma.module.upsert({
    where: { name: 'booking' },
    update: {},
    create: {
      name: 'booking',
      description: 'Module de réservation avec Google Calendar',
      version: '1.0.0',
    },
  });

  const paymentsModule = await prisma.module.upsert({
    where: { name: 'payments' },
    update: {},
    create: {
      name: 'payments',
      description: 'Module de paiements avec Stripe',
      version: '1.0.0',
    },
  });

  const emailModule = await prisma.module.upsert({
    where: { name: 'email' },
    update: {},
    create: {
      name: 'email',
      description: 'Module d\'envoi d\'emails avec SendGrid',
      version: '1.0.0',
    },
  });

  // Créer un client exemple avec domaine et variables d'environnement
  const client = await prisma.client.create({
    data: {
      name: 'Axe Wash',
      domain: 'axewash.domain.com', // Domaine personnalisé
      apiKeys: {
        googleCalendar: 'GOOGLE_API_KEY',
        notion: 'NOTION_API_KEY',
        stripe: 'STRIPE_SECRET',
        sendgrid: 'SENDGRID_API_KEY',
      },
      settings: {
        currency: 'EUR',
        timezone: 'Europe/Paris',
      },
      modules: {
        create: [
          { moduleId: bookingModule.id, enabled: true },
          { moduleId: paymentsModule.id, enabled: true },
          { moduleId: emailModule.id, enabled: true },
        ],
      },
      environmentVariables: {
        create: [
          { key: 'PORT', value: '3000', environment: 'DEVELOPMENT' },
          { key: 'DATABASE_URL', value: 'postgresql://localhost:5432/axewash_dev', environment: 'DEVELOPMENT' },
          { key: 'PORT', value: '3001', environment: 'PRODUCTION' },
          { key: 'DATABASE_URL', value: 'postgresql://prod-server:5432/axewash_prod', environment: 'PRODUCTION' },
          { key: 'STRIPE_WEBHOOK_SECRET', value: 'whsec_...', environment: 'PRODUCTION' },
        ],
      },
    },
    include: {
      modules: {
        include: {
          module: true,
        },
      },
      environmentVariables: true,
    },
  });

  console.log('✅ Client créé avec domaine et variables d\'environnement :', client);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
