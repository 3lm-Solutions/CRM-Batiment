import { Injectable } from '@nestjs/common';
import type { CompanySettings } from '../../../shared';
import type { AuthUser } from '../../../common';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DbClient } from '../../../prisma/prisma.types';
import { UpdateCompanyDto, UpdateCompanySettingsDto } from './dto/company.dto';

const PROFILE_SELECT = {
  id: true,
  nom: true,
  siret: true,
  adresse: true,
  telephone: true,
  email: true,
  logo: true,
} satisfies Prisma.CompanySelect;

const SETTINGS_SELECT = {
  tvaDefaut: true,
  devise: true,
  acomptePercentDefault: true,
  margeCiblePourcent: true,
  seuilAlerteMargePourcent: true,
  fraisFixeDeplacement: true,
  pasArrondiPrix: true,
} satisfies Prisma.CompanySelect;

export type CompanySettingsRecord = Prisma.CompanyGetPayload<{ select: typeof SETTINGS_SELECT }>;

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  getProfile(user: AuthUser) {
    return this.prisma.company.findUniqueOrThrow({ where: { id: user.companyId }, select: PROFILE_SELECT });
  }

  updateProfile(user: AuthUser, dto: UpdateCompanyDto) {
    return this.prisma.company.update({ where: { id: user.companyId }, data: dto, select: PROFILE_SELECT });
  }

  /** Raw Decimal values — for other services (pricing, quotes, invoices). */
  getSettingsRecord(companyId: number, db: DbClient = this.prisma): Promise<CompanySettingsRecord> {
    return db.company.findUniqueOrThrow({ where: { id: companyId }, select: SETTINGS_SELECT });
  }

  async getSettings(user: AuthUser): Promise<CompanySettings> {
    return toSettings(await this.getSettingsRecord(user.companyId));
  }

  async updateSettings(user: AuthUser, dto: UpdateCompanySettingsDto): Promise<CompanySettings> {
    const updated = await this.prisma.company.update({
      where: { id: user.companyId },
      data: dto,
      select: SETTINGS_SELECT,
    });
    return toSettings(updated);
  }
}

function toSettings(r: CompanySettingsRecord): CompanySettings {
  return {
    tvaDefaut: r.tvaDefaut.toNumber(),
    devise: r.devise,
    acomptePercentDefault: r.acomptePercentDefault.toNumber(),
    margeCiblePourcent: r.margeCiblePourcent.toNumber(),
    seuilAlerteMargePourcent: r.seuilAlerteMargePourcent.toNumber(),
    fraisFixeDeplacement: r.fraisFixeDeplacement.toNumber(),
    pasArrondiPrix: r.pasArrondiPrix.toNumber(),
  };
}
