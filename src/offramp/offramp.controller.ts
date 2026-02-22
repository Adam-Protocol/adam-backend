import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { OfframpService } from './offramp.service';

@ApiTags('offramp')
@Controller('offramp')
export class OfframpController {
  constructor(private readonly offrampService: OfframpService) {}

  @Get('status/:referenceId')
  @ApiOperation({ summary: 'Get offramp transaction status' })
  @ApiParam({ name: 'referenceId', description: 'Monnify reference ID' })
  getStatus(@Param('referenceId') referenceId: string) {
    return this.offrampService.getStatus(referenceId);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Monnify payment webhook (internal)' })
  handleWebhook(@Body() payload: any) {
    return this.offrampService.handleWebhook(payload);
  }
}
