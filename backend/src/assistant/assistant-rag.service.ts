import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

type AssistantIntent =
  | 'demande_devis'
  | 'demande_info_service'
  | 'demande_prix'
  | 'information_generale'
  | 'autre';

type KnowledgeChunk = {
  sourceType: 'type_projet' | 'categorie' | 'prestation' | 'rag_document';
  sourceId: number;
  title: string;
  text: string;
  normalizedText: string;
  tokens: string[];
  priority?: number;
};

export type RagSnippet = {
  sourceType: 'type_projet' | 'categorie' | 'prestation' | 'rag_document';
  sourceId: number;
  title: string;
  excerpt: string;
  fullText: string;
  score: number;
};

type RagRetrievalInput = {
  companyId: number;
  query: string;
  projectType?: string;
  intent?: AssistantIntent;
  limit?: number;
};

type RagRetrievalResult = {
  snippets: RagSnippet[];
  context: string;
};

@Injectable()
export class AssistantRagService {
  private readonly cacheTtlMs = this.resolveCacheTtlMs();
  private readonly cache = new Map<
    number,
    { expiresAt: number; chunks: KnowledgeChunk[] }
  >();

  private readonly stopWords = new Set([
    'alors',
    'au',
    'aucun',
    'aussi',
    'avec',
    'avoir',
    'bien',
    'bonjour',
    'car',
    'cela',
    'ces',
    'chez',
    'comment',
    'dans',
    'des',
    'donc',
    'elle',
    'elles',
    'entre',
    'est',
    'etre',
    'fait',
    'faire',
    'ici',
    'ils',
    'les',
    'leur',
    'mais',
    'meme',
    'merci',
    'mon',
    'notre',
    'nous',
    'par',
    'pas',
    'plus',
    'pour',
    'prix',
    'projet',
    'quel',
    'quelle',
    'quelles',
    'quels',
    'sans',
    'serait',
    'sont',
    'sur',
    'tout',
    'tres',
    'une',
    'vous',
    'vos',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  async retrieveContext(input: RagRetrievalInput): Promise<RagRetrievalResult> {
    if (!this.isEnabled()) {
      return { snippets: [], context: '' };
    }

    const query = input.query.trim();
    if (!query) {
      return { snippets: [], context: '' };
    }

    const chunks = await this.getKnowledgeChunks(input.companyId);
    if (chunks.length === 0) {
      return { snippets: [], context: '' };
    }

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) {
      return { snippets: [], context: '' };
    }

    const limit = Math.min(Math.max(input.limit ?? 4, 1), 8);
    const scored = chunks
      .map((chunk) => ({
        chunk,
        score: this.computeScore({
          query,
          queryTokens,
          chunk,
          projectType: input.projectType,
          intent: input.intent,
        }),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const snippets: RagSnippet[] = scored.map(({ chunk, score }) => ({
      sourceType: chunk.sourceType,
      sourceId: chunk.sourceId,
      title: chunk.title,
      excerpt: this.toExcerpt(chunk.text),
      fullText: chunk.text,
      score: Number(score.toFixed(3)),
    }));

    const context = snippets.length > 0 ? this.buildContextBlock(snippets) : '';

    return {
      snippets,
      context,
    };
  }

  private isEnabled(): boolean {
    const raw = (process.env.ASSISTANT_RAG_ENABLED || 'true').trim().toLowerCase();
    return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
  }

  private async getKnowledgeChunks(companyId: number): Promise<KnowledgeChunk[]> {
    const now = Date.now();
    const cached = this.cache.get(companyId);
    if (this.cacheTtlMs > 0 && cached && cached.expiresAt > now) {
      return cached.chunks;
    }

    const [types, ragDocuments] = await Promise.all([
      this.prisma.typeProjet.findMany({
      where: {
        companyId,
        actif: true,
      },
      orderBy: { nom: 'asc' },
      select: {
        id: true,
        nom: true,
        description: true,
        categories: {
          select: {
            categorie: {
              select: {
                id: true,
                nom: true,
                description: true,
                prestations: {
                  where: { actif: true },
                  orderBy: { nom: 'asc' },
                  select: {
                    id: true,
                    nom: true,
                    description: true,
                    unite: true,
                    prixVenteMin: true,
                    prixVenteMax: true,
                  },
                },
              },
            },
          },
        },
      },
      }),
      this.prisma.ragDocument.findMany({
        where: {
          companyId,
          actif: true,
        },
        orderBy: [
          { priorite: 'desc' },
          { updatedAt: 'desc' },
        ],
        select: {
          id: true,
          titre: true,
          categorie: true,
          contenu: true,
          priorite: true,
        },
      }),
    ]);

    const chunks: KnowledgeChunk[] = [];

    for (const document of ragDocuments) {
      const text = [
        `Document RAG: ${document.titre}`,
        `Categorie: ${document.categorie}`,
        document.contenu,
      ].join('. ');

      chunks.push(this.createChunk({
        sourceType: 'rag_document',
        sourceId: document.id,
        title: `Base IA - ${document.titre}`,
        text,
        priority: document.priorite,
      }));
    }

    for (const type of types) {
      const categories = type.categories.map((entry) => entry.categorie);
      const uniqueCategorieNames = [...new Set(categories.map((cat) => cat.nom))];

      const typeText = [
        `Type de projet: ${type.nom}`,
        type.description ? `Description: ${type.description}` : '',
        uniqueCategorieNames.length > 0
          ? `Categories disponibles: ${uniqueCategorieNames.join(', ')}`
          : 'Aucune categorie disponible',
      ]
        .filter((part) => part.length > 0)
        .join('. ');

      chunks.push(this.createChunk({
        sourceType: 'type_projet',
        sourceId: type.id,
        title: `Service ${type.nom}`,
        text: typeText,
      }));

      for (const categorie of categories) {
        const prestations = categorie.prestations.slice(0, 10);

        const categorieText = [
          `Type de projet: ${type.nom}`,
          `Categorie: ${categorie.nom}`,
          categorie.description ? `Description: ${categorie.description}` : '',
          prestations.length > 0
            ? `Prestations: ${prestations.map((prestation) => prestation.nom).join(', ')}`
            : 'Aucune prestation active',
        ]
          .filter((part) => part.length > 0)
          .join('. ');

        chunks.push(this.createChunk({
          sourceType: 'categorie',
          sourceId: categorie.id,
          title: `Categorie ${categorie.nom} (${type.nom})`,
          text: categorieText,
        }));

        for (const prestation of prestations) {
          const prestationText = [
            `Type de projet: ${type.nom}`,
            `Categorie: ${categorie.nom}`,
            `Prestation: ${prestation.nom}`,
            prestation.description ? `Description: ${prestation.description}` : '',
            `Unite: ${prestation.unite}`,
            `Prix indicatif: ${prestation.prixVenteMin.toFixed(2)} EUR a ${prestation.prixVenteMax.toFixed(2)} EUR`,
          ]
            .filter((part) => part.length > 0)
            .join('. ');

          chunks.push(this.createChunk({
            sourceType: 'prestation',
            sourceId: prestation.id,
            title: `Prestation ${prestation.nom} (${type.nom})`,
            text: prestationText,
          }));
        }
      }
    }

    if (this.cacheTtlMs > 0) {
      this.cache.set(companyId, {
        expiresAt: now + this.cacheTtlMs,
        chunks,
      });
    }

    return chunks;
  }

  private resolveCacheTtlMs(): number {
    const raw = Number.parseInt(process.env.ASSISTANT_RAG_CACHE_TTL_MS || '0', 10);
    if (Number.isNaN(raw) || raw < 0) return 0;
    return raw;
  }

  private computeScore(input: {
    query: string;
    queryTokens: string[];
    chunk: KnowledgeChunk;
    projectType?: string;
    intent?: AssistantIntent;
  }): number {
    const chunkTokenSet = new Set(input.chunk.tokens);
    const overlap = input.queryTokens.filter((token) => chunkTokenSet.has(token));

    if (overlap.length === 0) {
      return 0;
    }

    const coverage = overlap.length / input.queryTokens.length;
    const density = overlap.length / Math.max(input.chunk.tokens.length, 1);
    let score = coverage * 0.9 + density * 0.1;

    const normalizedQuery = this.normalize(input.query);
    if (
      normalizedQuery.length > 10 &&
      input.chunk.normalizedText.includes(normalizedQuery)
    ) {
      score += 0.22;
    }

    if (input.projectType) {
      const normalizedProjectType = this.normalize(input.projectType);
      if (normalizedProjectType && input.chunk.normalizedText.includes(normalizedProjectType)) {
        score += 0.2;
      }
    }

    if (input.intent === 'demande_prix' && input.chunk.sourceType === 'prestation') {
      score += 0.15;
    }

    if (input.chunk.sourceType === 'rag_document') {
      score += 0.08 + Math.min(input.chunk.priority ?? 0, 100) * 0.002;
    }

    return score;
  }

  private createChunk(input: {
    sourceType: KnowledgeChunk['sourceType'];
    sourceId: number;
    title: string;
    text: string;
    priority?: number;
  }): KnowledgeChunk {
    const normalizedText = this.normalize(`${input.title}. ${input.text}`);
    const tokens = this.tokenize(normalizedText);

    return {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      title: input.title,
      text: input.text,
      normalizedText,
      tokens,
      priority: input.priority,
    };
  }

  private buildContextBlock(snippets: RagSnippet[]): string {
    const lines = snippets.slice(0, 4).map((snippet, index) => {
      return `${index + 1}. ${snippet.title} - ${snippet.excerpt}`;
    });

    return ['Contexte metier local (RAG):', ...lines].join('\n');
  }

  private toExcerpt(text: string): string {
    const compact = text.replace(/\s+/g, ' ').trim();
    if (compact.length <= 180) {
      return compact;
    }
    return `${compact.slice(0, 177)}...`;
  }

  private tokenize(text: string): string[] {
    const normalized = this.normalize(text);
    const tokens = normalized
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
      .filter((token) => !this.stopWords.has(token));

    return [...new Set(tokens)];
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }
}
