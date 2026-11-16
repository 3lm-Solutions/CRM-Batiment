import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../../../common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CompositionValidator } from '../compositions/composition-validator.service';
import type { ReplaceCompositionsDto } from '../compositions/compositions.dto';
import { CreateChoixDto, CreateOptionDto, UpdateChoixDto, UpdateOptionDto } from './options.dto';

/**
 * Options of a prestation ("Type de chape") and their choices ("Chape fibrée").
 * Ownership is always checked through the parent prestation's companyId.
 */
@Injectable()
export class OptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly compositions: CompositionValidator,
  ) {}

  async createOption(user: AuthUser, prestationId: number, dto: CreateOptionDto) {
    const prestation = await this.prisma.prestation.count({
      where: { id: prestationId, companyId: user.companyId },
    });
    if (!prestation) throw new NotFoundException(`Prestation #${prestationId} introuvable`);
    return this.prisma.optionPrestation.create({
      data: { ...dto, prestationId },
      include: { choix: true },
    });
  }

  async updateOption(user: AuthUser, id: number, dto: UpdateOptionDto) {
    await this.findOption(user, id);
    return this.prisma.optionPrestation.update({
      where: { id },
      data: dto,
      include: { choix: true },
    });
  }

  async removeOption(user: AuthUser, id: number): Promise<void> {
    await this.findOption(user, id);
    await this.prisma.optionPrestation.delete({ where: { id } });
  }

  async createChoix(user: AuthUser, optionId: number, dto: CreateChoixDto) {
    await this.findOption(user, optionId);
    return this.prisma.choixOption.create({ data: { ...dto, optionId } });
  }

  async updateChoix(user: AuthUser, id: number, dto: UpdateChoixDto) {
    await this.findChoix(user, id);
    return this.prisma.choixOption.update({ where: { id }, data: dto });
  }

  async removeChoix(user: AuthUser, id: number): Promise<void> {
    await this.findChoix(user, id);
    await this.prisma.choixOption.delete({ where: { id } });
  }

  /**
   * A choice composition REPLACES the prestation's base composition when the choice is
   * selected. An empty list removes it (the base composition applies again).
   */
  async replaceChoixCompositions(user: AuthUser, id: number, dto: ReplaceCompositionsDto) {
    await this.findChoix(user, id);
    await this.compositions.assertValid(user.companyId, dto.items);
    await this.prisma.$transaction([
      this.prisma.choixOptionComposition.deleteMany({ where: { choixOptionId: id } }),
      this.prisma.choixOptionComposition.createMany({
        data: this.compositions.toRows(dto.items).map((row) => ({ ...row, choixOptionId: id })),
      }),
    ]);
    return this.prisma.choixOption.findUniqueOrThrow({
      where: { id },
      include: { compositions: true },
    });
  }

  private async findOption(user: AuthUser, id: number) {
    const row = await this.prisma.optionPrestation.findFirst({
      where: { id, prestation: { companyId: user.companyId } },
    });
    if (!row) throw new NotFoundException(`Option #${id} introuvable`);
    return row;
  }

  private async findChoix(user: AuthUser, id: number) {
    const row = await this.prisma.choixOption.findFirst({
      where: { id, option: { prestation: { companyId: user.companyId } } },
    });
    if (!row) throw new NotFoundException(`Choix #${id} introuvable`);
    return row;
  }
}
