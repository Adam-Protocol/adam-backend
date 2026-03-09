/**
 * Currency configuration for Adam Protocol
 * Maps currency codes to their token symbols and exchange rate sources
 */

export interface CurrencyConfig {
  code: string; // ISO currency code (NGN, KES, GHS, ZAR)
  token: string; // Token symbol (ADNGN, ADKES, ADGHS, ADZAR)
  name: string; // Full name
  exchangeRateApiCode: string; // Code used in ExchangeRate-API
  flutterwaveCode: string; // Code used in Flutterwave API
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  NGN: {
    code: 'NGN',
    token: 'ADNGN',
    name: 'Nigerian Naira',
    exchangeRateApiCode: 'NGN',
    flutterwaveCode: 'NGN',
  },
  KES: {
    code: 'KES',
    token: 'ADKES',
    name: 'Kenyan Shilling',
    exchangeRateApiCode: 'KES',
    flutterwaveCode: 'KES',
  },
  GHS: {
    code: 'GHS',
    token: 'ADGHS',
    name: 'Ghanaian Cedi',
    exchangeRateApiCode: 'GHS',
    flutterwaveCode: 'GHS',
  },
  ZAR: {
    code: 'ZAR',
    token: 'ADZAR',
    name: 'South African Rand',
    exchangeRateApiCode: 'ZAR',
    flutterwaveCode: 'ZAR',
  },
};

export const CURRENCY_PAIRS = [
  { from: 'ADUSD', to: 'ADNGN', currency: 'NGN' },
  { from: 'ADUSD', to: 'ADKES', currency: 'KES' },
  { from: 'ADUSD', to: 'ADGHS', currency: 'GHS' },
  { from: 'ADUSD', to: 'ADZAR', currency: 'ZAR' },
];
