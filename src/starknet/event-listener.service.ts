import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StarknetService } from './starknet.service';
import { PrismaService } from '../prisma/prisma.service';
import { hash } from 'starknet';

@Injectable()
export class EventListenerService implements OnModuleInit {
  private readonly logger = new Logger(EventListenerService.name);
  private lastProcessedBlock = 0;

  constructor(
    private readonly starknet: StarknetService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      // Get the latest block on startup
      const block = await this.starknet.rpcProvider.getBlockNumber();
      this.lastProcessedBlock = block - 100; // Start from 100 blocks ago
      this.logger.log(`Event listener initialized at block ${this.lastProcessedBlock}`);
    } catch (err) {
      this.logger.warn('Event listener initialization failed (RPC may be unavailable)', err);
      this.lastProcessedBlock = 0;
    }
  }

  /**
   * Poll for contract events every 30 seconds
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollEvents() {
    try {
      const currentBlock = await this.starknet.rpcProvider.getBlockNumber();
      
      if (currentBlock <= this.lastProcessedBlock) {
        return; // No new blocks
      }

      await this.processSwapEvents(this.lastProcessedBlock + 1, currentBlock);
      await this.processPoolEvents(this.lastProcessedBlock + 1, currentBlock);

      this.lastProcessedBlock = currentBlock;
    } catch (err) {
      this.logger.error('Event polling failed', err);
    }
  }

  /**
   * Process AdamSwap events: BuyExecuted, SellExecuted, SwapExecuted
   */
  private async processSwapEvents(fromBlock: number, toBlock: number) {
    const swapAddress = this.config.get<string>('ADAM_SWAP_ADDRESS');
    if (!swapAddress) return;

    try {
      // Get events from the contract
      const events = await this.starknet.rpcProvider.getEvents({
        from_block: { block_number: fromBlock },
        to_block: { block_number: toBlock },
        address: swapAddress,
        chunk_size: 100,
      });

      for (const event of events.events) {
        await this.handleSwapEvent(event);
      }
    } catch (err) {
      this.logger.error('Failed to process swap events', err);
    }
  }

  /**
   * Process AdamPool events: CommitmentRegistered, NullifierSpent
   */
  private async processPoolEvents(fromBlock: number, toBlock: number) {
    const poolAddress = this.config.get<string>('ADAM_POOL_ADDRESS');
    if (!poolAddress) return;

    try {
      const events = await this.starknet.rpcProvider.getEvents({
        from_block: { block_number: fromBlock },
        to_block: { block_number: toBlock },
        address: poolAddress,
        chunk_size: 100,
      });

      for (const event of events.events) {
        await this.handlePoolEvent(event);
      }
    } catch (err) {
      this.logger.error('Failed to process pool events', err);
    }
  }

  /**
   * Handle individual swap events
   */
  private async handleSwapEvent(event: any) {
    const eventName = this.getEventName(event.keys[0]);

    switch (eventName) {
      case 'BuyExecuted':
        await this.handleBuyExecuted(event);
        break;
      case 'SellExecuted':
        await this.handleSellExecuted(event);
        break;
      case 'SwapExecuted':
        await this.handleSwapExecuted(event);
        break;
      case 'RateUpdated':
        this.logger.log(`Rate updated on-chain: ${event.data}`);
        break;
    }
  }

  /**
   * Handle individual pool events
   */
  private async handlePoolEvent(event: any) {
    const eventName = this.getEventName(event.keys[0]);

    switch (eventName) {
      case 'CommitmentRegistered':
        await this.handleCommitmentRegistered(event);
        break;
      case 'NullifierSpent':
        await this.handleNullifierSpent(event);
        break;
    }
  }

  /**
   * BuyExecuted event handler
   * Event data: { commitment: felt252, token_out: ContractAddress, timestamp: u64 }
   */
  private async handleBuyExecuted(event: any) {
    const commitment = event.data[0];
    const txHash = event.transaction_hash;

    const tx = await this.prisma.transaction.findUnique({
      where: { commitment },
    });

    if (tx && tx.status !== 'completed') {
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'completed', tx_hash: txHash },
      });
      this.logger.log(`Buy confirmed on-chain: ${tx.id} (${txHash})`);
    }
  }

  /**
   * SellExecuted event handler
   * Event data: { nullifier: felt252, token_in: ContractAddress, timestamp: u64 }
   */
  private async handleSellExecuted(event: any) {
    const nullifier = event.data[0];
    const txHash = event.transaction_hash;

    const tx = await this.prisma.transaction.findFirst({
      where: { nullifier },
    });

    if (tx && tx.status !== 'completed') {
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: { tx_hash: txHash },
      });
      this.logger.log(`Sell confirmed on-chain: ${tx.id} (${txHash})`);
    }
  }

  /**
   * SwapExecuted event handler
   * Event data: { commitment: felt252, token_in: ContractAddress, token_out: ContractAddress, timestamp: u64 }
   */
  private async handleSwapExecuted(event: any) {
    const commitment = event.data[0];
    const txHash = event.transaction_hash;

    const tx = await this.prisma.transaction.findUnique({
      where: { commitment },
    });

    if (tx && tx.status !== 'completed') {
      await this.prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'completed', tx_hash: txHash },
      });
      this.logger.log(`Swap confirmed on-chain: ${tx.id} (${txHash})`);
    }
  }

  /**
   * CommitmentRegistered event handler
   */
  private async handleCommitmentRegistered(event: any) {
    const commitment = event.data[0];
    this.logger.debug(`Commitment registered on-chain: ${commitment}`);
  }

  /**
   * NullifierSpent event handler
   */
  private async handleNullifierSpent(event: any) {
    const nullifier = event.data[0];
    this.logger.debug(`Nullifier spent on-chain: ${nullifier}`);
  }

  /**
   * Get event name from event key (selector hash)
   */
  private getEventName(key: string): string {
    const eventMap: Record<string, string> = {
      [hash.getSelectorFromName('BuyExecuted')]: 'BuyExecuted',
      [hash.getSelectorFromName('SellExecuted')]: 'SellExecuted',
      [hash.getSelectorFromName('SwapExecuted')]: 'SwapExecuted',
      [hash.getSelectorFromName('RateUpdated')]: 'RateUpdated',
      [hash.getSelectorFromName('CommitmentRegistered')]: 'CommitmentRegistered',
      [hash.getSelectorFromName('NullifierSpent')]: 'NullifierSpent',
    };
    return eventMap[key] || 'Unknown';
  }
}
