import { StripeService } from './stripe.service';
import { PayPalService } from './paypal.service';
import { WiseService } from './wise.service';
import { Payment } from '../../types/invoice.types';

export class PaymentProviderFactory {
  private static stripeService: StripeService;
  private static paypalService: PayPalService;
  private static wiseService: WiseService;

  static getProvider(provider: 'stripe' | 'paypal' | 'wise'): StripeService | PayPalService | WiseService {
    switch (provider) {
      case 'stripe':
        if (!this.stripeService) {
          this.stripeService = new StripeService();
        }
        return this.stripeService;
      case 'paypal':
        if (!this.paypalService) {
          this.paypalService = new PayPalService();
        }
        return this.paypalService;
      case 'wise':
        if (!this.wiseService) {
          this.wiseService = new WiseService();
        }
        return this.wiseService;
      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }
  }

  static async processPayment(payment: Payment): Promise<Payment> {
    const provider = this.getProvider(payment.provider);
    return await provider.processPayment(payment);
  }
}

export { StripeService, PayPalService, WiseService };
