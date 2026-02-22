import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
}
