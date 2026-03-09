import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { SwapService } from './swap.service';
import { SwapDto } from './swap.dto';
import { RateSource } from './rate-source.enum';

@ApiTags('swap')
@Controller('swap')
export class SwapController {
  constructor(private readonly swapService: SwapService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Record swap transaction (execution happens on frontend)',
  })
  swap(@Body() dto: SwapDto) {
    return this.swapService.swap(dto);
  }

  @Get('rate')
  @ApiOperation({ summary: 'Get live USD/NGN rate (legacy)' })
  @ApiResponse({
    status: 200,
    description: 'Returns { usd_ngn, updated_at, source }',
  })
  getRate() {
    return this.swapService.getLiveRate();
  }

  @Get('rates')
  @ApiOperation({ summary: 'Get all currency rates (USD to NGN, KES, GHS, ZAR)' })
  @ApiResponse({
    status: 200,
    description: 'Returns rates for all supported currencies',
  })
  getAllRates() {
    return this.swapService.getAllRates();
  }

  @Get('rate/source')
  @ApiOperation({ summary: 'Get current default rate source' })
  @ApiResponse({ status: 200, description: 'Returns current rate source' })
  getRateSource() {
    return { source: this.swapService.getDefaultRateSource() };
  }

  @Put('rate/source')
  @ApiOperation({ summary: 'Set default rate source' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          enum: Object.values(RateSource),
          description: 'Rate source to use',
        },
      },
      required: ['source'],
    },
  })
  @ApiResponse({ status: 200, description: 'Rate source updated successfully' })
  setRateSource(@Body('source') source: RateSource) {
    return this.swapService.setDefaultRateSource(source);
  }
}
