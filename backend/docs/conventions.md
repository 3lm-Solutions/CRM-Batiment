# Conventions backend (à suivre pour chaque module de la phase B)

## Pipeline d'une requête

```
requête
  → request-context middleware   X-Request-Id + log d'une ligne
  → JwtAuthGuard (global)        401 sauf @Public()
  → RolesGuard (global)          403 si rôle absent de @Roles() — et 403 si @Roles() oublié
  → ValidationPipe (global)      400 si DTO invalide ou champ inconnu
  → controller → service
  → DecimalSerializerInterceptor Decimal → number dans le JSON
  → AllExceptionsFilter          toute erreur → format ApiErrorResponse
```

## Squelette d'un controller

```ts
import { type AuthUser, BUREAU, CurrentUser, Roles } from '../../../common';

@ApiTags('Devis')
@ApiBearerAuth()
@Roles(...BUREAU)                       // rôles par défaut du controller
@Controller('devis')
export class DevisController {
  constructor(private readonly devis: DevisService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryDevisDto) {
    return this.devis.findAll(user, query);   // companyId vient TOUJOURS du token
  }

  @Roles(Role.ADMIN)                     // une route peut restreindre davantage
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.devis.remove(user, id);
  }
}
```

## Règles

| Sujet | Règle |
|---|---|
| Multi-entreprise | `companyId` vient de `@CurrentUser()`. Toute requête Prisma filtre par `companyId`. Jamais `findUnique({ where: { id } })` seul : utiliser `findFirst({ where: { id, companyId } })`. |
| Listes | Le DTO de requête étend `PaginationQueryDto` ; le service renvoie `paginate(data, total, query)`. Tri : `parseSort(query.sort, [champs autorisés], défaut)`. |
| Montants | Uniquement via `common/money` (`lineTotal`, `sumMoney`, `percentOf`, `computeTotals`, `marginPercent`). Jamais d'arithmétique sur des `number`. |
| Références | `referenceService.next(ReferencePrefix.DEVIS, companyId, tx)` — dans la transaction de création. |
| Règle métier violée | `throw new BusinessException('CODE_STABLE', 'Message en français')` → 422. |
| Introuvable | `NotFoundException` → 404 (ou laisser Prisma P2025 remonter). |
| Suppression d'un élément utilisé | Laisser Prisma P2003 remonter → 409 RESOURCE_IN_USE. Préférer `actif = false`. |
| Transactions | Les méthodes de service qui écrivent acceptent `db: DbClient = this.prisma` en dernier paramètre. |
| Changement de statut | Jamais via `PATCH`. Une route d'action par transition : `POST /devis/:id/envoyer`. |
| Effets de bord | Notifications, audit, emails, WhatsApp : événements émis **après** commit (`EventEmitter2`). |
| Transformations de DTO | `@Trim()`, `@TrimOrNull()` (champ effaçable), `@NormalizeEmail()`, `@ToBoolean()` (jamais `@Type(() => Boolean)` : `"false"` deviendrait `true`), `@ToIntArray()`. |
| Désactiver vs supprimer | `PATCH { actif: false }` masque un élément. `DELETE` est une suppression définitive, refusée (409) si l'élément est utilisé. |
| Imports de types | Une interface utilisée dans la signature d'une méthode décorée (`user: AuthUser`, payload d'un `@OnEvent`) s'importe avec `type` : `import { type AuthUser }`. Sinon TypeScript refuse (TS1272, `isolatedModules` + `emitDecoratorMetadata`). |
| Calculs | Toute logique de calcul va dans une fonction pure testée unitairement (ex. `pricing.calculator.ts`). |
