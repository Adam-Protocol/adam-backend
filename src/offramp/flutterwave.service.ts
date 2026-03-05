import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

interface FlutterwaveAuthResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  refresh_token: string;
  token_type: string;
}

interface FlutterwaveTransferPayload {
  account_bank: string;
  account_number: string;
  amount: number;
  narration: string;
  currency: string;
  reference: string;
  callback_url?: string;
  debit_currency?: string;
}

@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);
  private axiosInstance: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.axiosInstance = axios.create({
      timeout: 30000,
    });
  }

  /** Authenticate with Flutterwave and get access token */
  private async authenticate(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const authUrl = this.config.get<string>('FLUTTERWAVE_AUTH_URL');
      const clientId = this.config.get<string>('FLUTTERWAVE_PUBLIC_KEY');
      const clientSecret = this.config.get<string>('FLUTTERWAVE_SECRET_KEY');

      if (!authUrl || !clientId || !clientSecret) {
        throw new Error('Flutterwave configuration missing');
      }

      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);

      const response = await this.axiosInstance.post<FlutterwaveAuthResponse>(
        authUrl,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      this.accessToken = response.data.access_token;
      // Set expiry 5 minutes before actual expiry for safety
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

      this.logger.log('Flutterwave authentication successful');
      return this.accessToken;
    } catch (error) {
      this.logger.error('Flutterwave authentication failed', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Flutterwave');
    }
  }

  /** Get status of a transfer by reference */
  async getStatus(referenceId: string) {
    const tx = await this.prisma.transaction.findFirst({
      where: { reference_id: referenceId },
      select: {
        id: true,
        status: true,
        type: true,
        currency: true,
        token_in: true,
        token_out: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }

  /** Verify webhook signature */
  private verifyWebhookSignature(payload: any, signature: string): boolean {
    const secretHash = this.config.get<string>('FLUTTERWAVE_WEBHOOK_SECRET_HASH');
    if (!secretHash) {
      this.logger.warn('Webhook secret hash not configured');
      return false;
    }
    const hash = crypto.createHmac('sha256', secretHash).update(JSON.stringify(payload)).digest('hex');
    return hash === signature;
  }

  /** Handle Flutterwave webhook */
  async handleWebhook(payload: any, signature: string) {
    this.logger.log(`Flutterwave webhook received: ${payload.event}`);

    // Verify webhook signature
    if (!this.verifyWebhookSignature(payload, signature)) {
      this.logger.warn('Invalid webhook signature');
      return { status: 'error', message: 'Invalid signature' };
    }

    const { event, data } = payload;

    // Handle different webhook events
    switch (event) {
      case 'transfer.completed':
        return this.handleTransferCompleted(data);
      case 'transfer.failed':
        return this.handleTransferFailed(data);
      case 'transfer.reversed':
        return this.handleTransferReversed(data);
      default:
        this.logger.log(`Unhandled webhook event: ${event}`);
        return { status: 'received' };
    }
  }

  private async handleTransferCompleted(data: any) {
    const reference = data.reference;
    const tx = await this.prisma.transaction.findFirst({
      where: { reference_id: reference },
    });

    if (!tx) {
      this.logger.warn(`No transaction found for reference ${reference}`);
      return { status: 'not_found' };
    }

    await this.prisma.transaction.update({
      where: { id: tx.id },
      data: { status: 'completed' },
    });

    this.logger.log(`Transaction ${tx.id} completed via Flutterwave`);
    return { status: 'success' };
  }

  private async handleTransferFailed(data: any) {
    const reference = data.reference;
    const tx = await this.prisma.transaction.findFirst({
      where: { reference_id: reference },
    });

    if (!tx) {
      this.logger.warn(`No transaction found for reference ${reference}`);
      return { status: 'not_found' };
    }

    await this.prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: 'failed',
        error: data.complete_message || 'Transfer failed',
      },
    });

    this.logger.log(`Transaction ${tx.id} failed: ${data.complete_message}`);
    return { status: 'success' };
  }

  private async handleTransferReversed(data: any) {
    const reference = data.reference;
    const tx = await this.prisma.transaction.findFirst({
      where: { reference_id: reference },
    });

    if (!tx) {
      this.logger.warn(`No transaction found for reference ${reference}`);
      return { status: 'not_found' };
    }

    await this.prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: 'failed',
        error: 'Transfer reversed',
      },
    });

    this.logger.log(`Transaction ${tx.id} reversed`);
    return { status: 'success' };
  }

  /** Initiate bank transfer via Flutterwave */
  async initiateBankTransfer(params: {
    transactionId: string;
    amount: number;
    currency: string;
    bank_account: string;
    bank_code: string;
    narration: string;
  }) {
    const { transactionId, amount, currency, bank_account, bank_code, narration } = params;

    try {
      const token = await this.authenticate();
      const reference = `ADAM-${transactionId}-${Date.now()}`;

      const appUrl = this.config.get<string>('APP_URL');
      const transferPayload: FlutterwaveTransferPayload = {
        account_bank: bank_code,
        account_number: bank_account,
        amount,
        narration,
        currency,
        reference,
        callback_url: appUrl ? `${appUrl}/offramp/webhook` : undefined,
      };

      const response = await this.axiosInstance.post(
        'https://api.flutterwave.com/v3/transfers',
        transferPayload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { reference_id: reference, status: 'processing' },
      });

      this.logger.log(`Flutterwave transfer initiated: ${reference}`);
      return response.data;
    } catch (error) {
      this.logger.error('Flutterwave transfer failed', error.response?.data || error.message);

      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'failed',
          error: error.response?.data?.message || 'Transfer initiation failed',
        },
      });

      throw error;
    }
  }

  /** Get exchange rate from Flutterwave */
  async getExchangeRate(from: string, to: string, amount: number = 1): Promise<number> {
    try {
      const token = await this.authenticate();

      const response = await this.axiosInstance.get(
        `https://api.flutterwave.com/v3/transfers/rates`,
        {
          params: {
            amount,
            destination_currency: to,
            source_currency: from,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const rate = response.data.data.rate;
      this.logger.log(`Flutterwave rate: 1 ${from} = ${rate} ${to}`);
      return rate;
    } catch (error) {
      this.logger.error('Failed to fetch Flutterwave exchange rate', error.response?.data || error.message);
      throw new Error('Failed to fetch exchange rate from Flutterwave');
    }
  }
}
