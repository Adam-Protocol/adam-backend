import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { IChainProvider } from '../interfaces/chain-provider.interface';
import { IChainHandler } from '../../queue/chain-handler.interface';
import { StarknetService } from '../../starknet/starknet.service';
import { StacksService } from '../../stacks/stacks.service';
import { StarknetChainHandler } from '../../starknet/starknet.chain-handler';
import { StacksChainHandler } from '../../stacks/stacks.chain-handler';

export enum ChainType {
  STARKNET = 'STARKNET',
  STACKS = 'STACKS',
}

@Injectable()
export class ChainManagerService implements OnModuleInit {
  private providers: Record<string, IChainProvider> = {};
  private handlers: Record<string, IChainHandler> = {};

  constructor(
    private readonly starknetService: StarknetService,
    private readonly stacksService: StacksService,
    private readonly starknetHandler: StarknetChainHandler,
    private readonly stacksHandler: StacksChainHandler,
  ) {}

  onModuleInit() {
    this.providers[ChainType.STARKNET] = this.starknetService;
    this.providers[ChainType.STACKS] = this.stacksService;

    this.handlers[ChainType.STARKNET] = this.starknetHandler;
    this.handlers[ChainType.STACKS] = this.stacksHandler;
  }

  registerProvider(chain: ChainType, provider: IChainProvider) {
    this.providers[chain] = provider;
  }

  getProvider(chain: ChainType | string): IChainProvider {
    const provider = this.providers[chain as string];
    if (!provider) {
      throw new BadRequestException(`Unsupported chain provider: ${String(chain)}`);
    }
    return provider;
  }

  getHandler(chain: ChainType | string): IChainHandler {
    const handler = this.handlers[chain as string];
    if (!handler) {
      throw new BadRequestException(`Unsupported chain handler: ${String(chain)}`);
    }
    return handler;
  }
}
