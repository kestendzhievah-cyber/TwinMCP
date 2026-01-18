import axios from 'axios';

export interface TaxRate {
  country: string;
  region?: string;
  rate: number;
  type: 'VAT' | 'GST' | 'SALES_TAX';
  reverseCharge?: boolean;
}

export interface TaxCalculation {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxRate: number;
  taxType: string;
  breakdown: Array<{
    description: string;
    amount: number;
    rate: number;
  }>;
}

export interface CustomerTaxInfo {
  country: string;
  region?: string;
  postalCode?: string;
  isBusinessCustomer: boolean;
  vatNumber?: string;
  taxExempt?: boolean;
}

export class TaxService {
  private defaultTaxRate: number;
  private euCountries: Set<string>;
  private taxRatesCache: Map<string, TaxRate>;
  private cacheExpiry: number = 24 * 60 * 60 * 1000;

  constructor() {
    this.defaultTaxRate = Number.parseFloat(process.env.DEFAULT_TAX_RATE || '0.2');
    
    this.euCountries = new Set([
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
      'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
      'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
    ]);

    this.taxRatesCache = new Map();
    this.initializeDefaultRates();
  }

  private initializeDefaultRates(): void {
    const defaultRates: TaxRate[] = [
      { country: 'FR', rate: 0.20, type: 'VAT' },
      { country: 'DE', rate: 0.19, type: 'VAT' },
      { country: 'GB', rate: 0.20, type: 'VAT' },
      { country: 'ES', rate: 0.21, type: 'VAT' },
      { country: 'IT', rate: 0.22, type: 'VAT' },
      { country: 'NL', rate: 0.21, type: 'VAT' },
      { country: 'BE', rate: 0.21, type: 'VAT' },
      { country: 'AT', rate: 0.20, type: 'VAT' },
      { country: 'SE', rate: 0.25, type: 'VAT' },
      { country: 'DK', rate: 0.25, type: 'VAT' },
      { country: 'FI', rate: 0.24, type: 'VAT' },
      { country: 'PL', rate: 0.23, type: 'VAT' },
      { country: 'PT', rate: 0.23, type: 'VAT' },
      { country: 'IE', rate: 0.23, type: 'VAT' },
      { country: 'US', rate: 0.00, type: 'SALES_TAX' },
      { country: 'CA', rate: 0.05, type: 'GST' },
      { country: 'AU', rate: 0.10, type: 'GST' },
      { country: 'NZ', rate: 0.15, type: 'GST' },
      { country: 'CH', rate: 0.077, type: 'VAT' },
      { country: 'NO', rate: 0.25, type: 'VAT' },
    ];

    defaultRates.forEach(rate => {
      this.taxRatesCache.set(rate.country, rate);
    });
  }

  async calculateTax(
    amount: number,
    customerInfo: CustomerTaxInfo,
    currency: string = 'EUR'
  ): Promise<TaxCalculation> {
    if (customerInfo.taxExempt) {
      return {
        subtotal: amount,
        taxAmount: 0,
        total: amount,
        taxRate: 0,
        taxType: 'EXEMPT',
        breakdown: [],
      };
    }

    const taxRate = await this.getTaxRate(customerInfo);

    if (this.shouldApplyReverseCharge(customerInfo)) {
      return {
        subtotal: amount,
        taxAmount: 0,
        total: amount,
        taxRate: 0,
        taxType: 'REVERSE_CHARGE',
        breakdown: [{
          description: 'Reverse Charge (B2B EU)',
          amount: 0,
          rate: 0,
        }],
      };
    }

    const taxAmount = amount * taxRate.rate;
    const total = amount + taxAmount;

    return {
      subtotal: amount,
      taxAmount: Number.parseFloat(taxAmount.toFixed(2)),
      total: Number.parseFloat(total.toFixed(2)),
      taxRate: taxRate.rate,
      taxType: taxRate.type,
      breakdown: [{
        description: `${taxRate.type} (${customerInfo.country})`,
        amount: Number.parseFloat(taxAmount.toFixed(2)),
        rate: taxRate.rate,
      }],
    };
  }

  async getTaxRate(customerInfo: CustomerTaxInfo): Promise<TaxRate> {
    const cacheKey = `${customerInfo.country}-${customerInfo.region || ''}`;
    
    if (this.taxRatesCache.has(cacheKey)) {
      return this.taxRatesCache.get(cacheKey)!;
    }

    if (process.env.STRIPE_TAX_ENABLED === 'true') {
      try {
        const stripeTaxRate = await this.getStripeTaxRate(customerInfo);
        if (stripeTaxRate) {
          this.taxRatesCache.set(cacheKey, stripeTaxRate);
          return stripeTaxRate;
        }
      } catch (error) {
        console.error('Failed to fetch Stripe tax rate:', error);
      }
    }

    const defaultRate: TaxRate = this.taxRatesCache.get(customerInfo.country) || {
      country: customerInfo.country,
      rate: this.defaultTaxRate,
      type: 'VAT',
    };

    return defaultRate;
  }

  private async getStripeTaxRate(customerInfo: CustomerTaxInfo): Promise<TaxRate | null> {
    try {
      const response = await axios.post(
        'https://api.stripe.com/v1/tax/calculations',
        {
          currency: 'eur',
          customer_details: {
            address: {
              country: customerInfo.country,
              postal_code: customerInfo.postalCode,
              state: customerInfo.region,
            },
            address_source: 'billing',
          },
          line_items: [{
            amount: 10000,
            reference: 'test',
          }],
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (response.data && response.data.tax_amount_exclusive) {
        const rate = response.data.tax_amount_exclusive / 10000;
        return {
          country: customerInfo.country,
          region: customerInfo.region,
          rate,
          type: 'VAT',
        };
      }
    } catch (error) {
      console.error('Stripe Tax API error:', error);
    }

    return null;
  }

  private shouldApplyReverseCharge(customerInfo: CustomerTaxInfo): boolean {
    if (!customerInfo.isBusinessCustomer || !customerInfo.vatNumber) {
      return false;
    }

    const companyCountry = process.env.COMPANY_COUNTRY || 'FR';
    
    if (customerInfo.country === companyCountry) {
      return false;
    }

    return this.euCountries.has(customerInfo.country) && 
           this.euCountries.has(companyCountry);
  }

  async validateVATNumber(vatNumber: string, country: string): Promise<boolean> {
    if (!vatNumber || !country) {
      return false;
    }

    const cleanVAT = vatNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    
    if (!cleanVAT.startsWith(country)) {
      return false;
    }

    if (process.env.VIES_VALIDATION_ENABLED === 'true') {
      try {
        return await this.validateVATWithVIES(cleanVAT);
      } catch (error) {
        console.error('VIES validation error:', error);
      }
    }

    return this.validateVATFormat(cleanVAT, country);
  }

  private async validateVATWithVIES(vatNumber: string): Promise<boolean> {
    try {
      const countryCode = vatNumber.substring(0, 2);
      const vatNum = vatNumber.substring(2);

      const response = await axios.get(
        `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${vatNum}`,
        {
          timeout: 5000,
        }
      );

      return response.data?.valid === true;
    } catch (error) {
      console.error('VIES API error:', error);
      return false;
    }
  }

  private validateVATFormat(vatNumber: string, country: string): boolean {
    const patterns: Record<string, RegExp> = {
      'AT': /^ATU\d{8}$/,
      'BE': /^BE0?\d{9}$/,
      'BG': /^BG\d{9,10}$/,
      'CY': /^CY\d{8}[A-Z]$/,
      'CZ': /^CZ\d{8,10}$/,
      'DE': /^DE\d{9}$/,
      'DK': /^DK\d{8}$/,
      'EE': /^EE\d{9}$/,
      'EL': /^EL\d{9}$/,
      'ES': /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
      'FI': /^FI\d{8}$/,
      'FR': /^FR[A-Z0-9]{2}\d{9}$/,
      'GB': /^GB(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
      'HR': /^HR\d{11}$/,
      'HU': /^HU\d{8}$/,
      'IE': /^IE\d[A-Z0-9]\d{5}[A-Z]$/,
      'IT': /^IT\d{11}$/,
      'LT': /^LT(\d{9}|\d{12})$/,
      'LU': /^LU\d{8}$/,
      'LV': /^LV\d{11}$/,
      'MT': /^MT\d{8}$/,
      'NL': /^NL\d{9}B\d{2}$/,
      'PL': /^PL\d{10}$/,
      'PT': /^PT\d{9}$/,
      'RO': /^RO\d{2,10}$/,
      'SE': /^SE\d{12}$/,
      'SI': /^SI\d{8}$/,
      'SK': /^SK\d{10}$/,
    };

    const pattern = patterns[country];
    if (!pattern) {
      return false;
    }

    return pattern.test(vatNumber);
  }

  async generateTaxReport(
    startDate: Date,
    endDate: Date,
    country?: string
  ): Promise<{
    totalSales: number;
    totalTax: number;
    breakdown: Array<{
      country: string;
      sales: number;
      tax: number;
      rate: number;
    }>;
  }> {
    return {
      totalSales: 0,
      totalTax: 0,
      breakdown: [],
    };
  }

  getTaxExemptCountries(): string[] {
    return [];
  }

  isEUCountry(country: string): boolean {
    return this.euCountries.has(country);
  }

  getDefaultTaxRate(): number {
    return this.defaultTaxRate;
  }
}
