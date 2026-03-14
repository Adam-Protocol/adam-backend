import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TokenService } from './token.service';
import { BuyTokenDto, SellTokenDto } from './token.dto';

@ApiTags('token')
@Controller('token')
export class TokenController {
  constructor(private readonly tokenService: TokenService) {}

  @Post('buy')
  @HttpCode(202)
  @ApiOperation({ summary: 'Buy ADUSD or ADNGN with USDC' })
  @ApiResponse({ status: 202, description: 'Buy job enqueued' })
  buy(@Body() dto: BuyTokenDto) {
    return this.tokenService.buy(dto);
  }

  @Post('sell')
  @HttpCode(202)
  @ApiOperation({ summary: 'Sell ADUSD or ADNGN — triggers bank transfer' })
  @ApiResponse({ status: 202, description: 'Sell job enqueued' })
  sell(@Body() dto: SellTokenDto) {
    return this.tokenService.sell(dto);
  }

  @Get('balances/:wallet')
  @ApiOperation({ summary: 'Get token balances for a wallet' })
  @ApiQuery({ name: 'chain', enum: ['STARKNET', 'STACKS'], required: false, description: 'Chain to query balances on. Defaults to STARKNET.' })
  @ApiResponse({ status: 200, description: 'Returns token balances for the specified chain' })
  getBalances(@Param('wallet') wallet: string, @Query('chain') chain?: string) {
    return this.tokenService.getBalances(wallet, chain);
  }

  @Get('commitments/:wallet')
  @ApiOperation({ summary: 'Get all buy commitments for a wallet' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of commitments from completed buy transactions',
  })
  getCommitments(@Param('wallet') wallet: string) {
    return this.tokenService.getCommitments(wallet);
  }
}
