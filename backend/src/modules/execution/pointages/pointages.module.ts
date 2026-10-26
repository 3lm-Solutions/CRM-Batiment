import { Module } from '@nestjs/common';
import { PointagesController, PortailPointagesController } from './pointages.controller';
import { PointagesService } from './pointages.service';

/** Time tracking of the sous-traitants (21/10). NotificationsService is global. */
@Module({ controllers: [PointagesController, PortailPointagesController], providers: [PointagesService] })
export class PointagesModule {}
