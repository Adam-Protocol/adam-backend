import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SwapService } from './swap.service';
import { SwapDto } from './swap.dto';

@ApiTags('swap')
@Controller('swap')
export class SwapController {
  constructor(private readonly swapService: SwapService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({ summary: 'Swap ADUSD <-> ADNGN' })
  swap(@Body() dto: SwapDto) {
    return this.swapService.swap(dto);
  }

  @Get('rate')
  @ApiOperation({ summary: 'Get live USD/NGN rate' })
  @ApiResponse({ status: 200, description: 'Returns { usd_ngn, updated_at }' })
  getRate() {
    return this.swapService.getLiveRate();
  }
}
