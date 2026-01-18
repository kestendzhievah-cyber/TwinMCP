import '@testing-library/jest-dom';

global.beforeEach(() => {
  jest.clearAllMocks();
});

process.env.INVOICE_TAX_RATE = '0.2';
process.env.INVOICE_DUE_DAYS = '30';
process.env.INVOICE_CURRENCY = 'EUR';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock';
process.env.PAYPAL_CLIENT_ID = 'mock_client_id';
process.env.PAYPAL_CLIENT_SECRET = 'mock_client_secret';
process.env.PAYPAL_MODE = 'sandbox';
process.env.WISE_API_KEY = 'mock_wise_key';
process.env.WISE_PROFILE_ID = 'mock_profile_id';
process.env.WISE_MODE = 'sandbox';
