import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

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

interface FlutterwaveRateResponse {
  status: string;
  message: string;
  data: {
    rate: number;
    source: string;
    destination: string;
  };
}

interface FlutterwaveTransferResponse {
  status: string;
  message: string;
  data: {
    id: number;
    account_number: string;
    bank_code: string;
    full_name: string;
    created_at: string;
    currency: string;
    amount: number;
    fee: number;
    status: string;
    reference: string;
    narration: string;
    complete_message: string;
  };
}

@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);
  private axiosInstance: AxiosInstance;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.axiosInstance = axios.create({
      baseURL: 'https://api.flutterwave.com/v3',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /** Get Flutterwave API key */
  private getApiKey(): string {
    const secretKey = this.config.get<string>('FLUTTERWAVE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('FLUTTERWAVE_SECRET_KEY not configured');
    }
    return secretKey;
  }

  /** Get Flutterwave public key */
  private getPublicKey(): string {
    const publicKey = this.config.get<string>('FLUTTERWAVE_PUBLIC_KEY');
    if (!publicKey) {
      throw new Error('FLUTTERWAVE_PUBLIC_KEY not configured');
    }
    return publicKey;
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
      const apiKey = this.getApiKey();
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

      const response = await this.axiosInstance.post<FlutterwaveTransferResponse>(
        '/transfers',
        transferPayload,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Transfer initiation failed');
      }

      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: { reference_id: reference, status: 'processing' },
      });

      this.logger.log(`Flutterwave transfer initiated: ${reference}`);
      return response.data.data;
    } catch (error) {
      this.logger.error('Flutterwave transfer failed', error.response?.data || error.message);

      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'failed',
          error: error.response?.data?.message || error.message || 'Transfer initiation failed',
        },
      });

      throw error;
    }
  }

  /** Get exchange rate from Flutterwave */
  async getExchangeRate(from: string, to: string, amount: number = 1): Promise<number> {
    try {
      const apiKey = this.getApiKey();

      const response = await this.axiosInstance.get<FlutterwaveRateResponse>(
        '/transfers/rates',
        {
          params: {
            amount,
            destination_currency: to,
            source_currency: from,
          },
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to fetch exchange rate');
      }

      const rate = response.data.data.rate;
      this.logger.log(`Flutterwave rate: 1 ${from} = ${rate} ${to}`);
      return rate;
    } catch (error) {
      this.logger.error('Failed to fetch Flutterwave exchange rate', error.response?.data || error.message);
      throw new Error('Failed to fetch exchange rate from Flutterwave');
    }
  }
}
