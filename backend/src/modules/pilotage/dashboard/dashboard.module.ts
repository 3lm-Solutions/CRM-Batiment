import { Module } from '@nestjs/common';
import { VisitesModule } from '../../commercial/visites/visites.module';
import { DashboardController } from './dashboard.controller';
import { DashboardMobileService } from './dashboard-mobile.service';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [VisitesModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardMobileService],
})
export class DashboardModule {}
