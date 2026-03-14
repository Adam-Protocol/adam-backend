import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { IChainProvider } from '../interfaces/chain-provider.interface';
import { StarknetService } from '../../starknet/starknet.service';
import { StacksService } from '../../stacks/stacks.service';

export enum ChainType {
  STARKNET = 'STARKNET',
  STACKS = 'STACKS',
}

@Injectable()
export class ChainManagerService implements OnModuleInit {
  private providers: Record<string, IChainProvider> = {};

  constructor(
    private readonly starknetService: StarknetService,
    private readonly stacksService: StacksService,
  ) {}

  onModuleInit() {
    this.providers[ChainType.STARKNET] = this.starknetService;
    this.providers[ChainType.STACKS] = this.stacksService;
  }

  registerProvider(chain: ChainType, provider: IChainProvider) {
    this.providers[chain] = provider;
  }

  getProvider(chain: ChainType | string): IChainProvider {
    const provider = this.providers[chain as string];
    if (!provider) {
      throw new BadRequestException(`Unsupported chain: ${String(chain)}`);
    }
    return provider;
  }
}
