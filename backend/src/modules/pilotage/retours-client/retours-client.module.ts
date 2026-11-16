import { Module } from '@nestjs/common';
import { RetoursClientController } from './retours-client.controller';
import { RetoursClientService } from './retours-client.service';

/**
 * Comments and alerts of the client (Étapes 5–6 of 26/10). Exports the service for the client
 * online space (PortailsModule), which records the client's messages. Mail / notifications are global.
 */
@Module({
  controllers: [RetoursClientController],
  providers: [RetoursClientService],
  exports: [RetoursClientService],
})
export class RetoursClientModule {}
