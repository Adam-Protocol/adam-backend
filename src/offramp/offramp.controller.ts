import { Body, Controller, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { FlutterwaveService } from './flutterwave.service';

@ApiTags('offramp')
@Controller('offramp')
export class OfframpController {
  constructor(private readonly flutterwaveService: FlutterwaveService) {}

  @Get('status/:referenceId')
  @ApiOperation({ summary: 'Get offramp transaction status' })
  @ApiParam({ name: 'referenceId', description: 'Flutterwave reference ID' })
  getStatus(@Param('referenceId') referenceId: string) {
    return this.flutterwaveService.getStatus(referenceId);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Flutterwave payment webhook (internal)' })
  handleWebhook(
    @Body() payload: any,
    @Headers('verif-hash') signature: string,
  ) {
    return this.flutterwaveService.handleWebhook(payload, signature);
  }
}
