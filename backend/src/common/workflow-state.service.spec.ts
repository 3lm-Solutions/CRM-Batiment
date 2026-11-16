import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowStateService } from './workflow-state.service.js';
import { BusinessException } from './exceptions/business.exception.js';

describe('WorkflowStateService', () => {
  let service: WorkflowStateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkflowStateService],
    }).compile();

    service = module.get<WorkflowStateService>(WorkflowStateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateTransition (Devis)', () => {
    // Valid transitions (should return true)
    it('should validate BROUILLON -> ENVOYE', () => {
      expect(service.validateTransition('BROUILLON', 'ENVOYE')).toBe(true);
    });

    it('should validate BROUILLON -> ANNULE', () => {
      expect(service.validateTransition('BROUILLON', 'ANNULE')).toBe(true);
    });

    it('should validate ENVOYE -> ACCEPTE', () => {
      expect(service.validateTransition('ENVOYE', 'ACCEPTE')).toBe(true);
    });

    it('should validate ENVOYE -> REFUSE', () => {
      expect(service.validateTransition('ENVOYE', 'REFUSE')).toBe(true);
    });

    it('should validate ACCEPTE -> SIGNE', () => {
      expect(service.validateTransition('ACCEPTE', 'SIGNE')).toBe(true);
    });

    it('should validate REFUSE -> REVISE', () => {
      expect(service.validateTransition('REFUSE', 'REVISE')).toBe(true);
    });

    it('should validate REVISE -> RENVOYE', () => {
      expect(service.validateTransition('REVISE', 'RENVOYE')).toBe(true);
    });

    // Invalid transitions (should throw BusinessException)
    it('should reject SIGNE -> BROUILLON and throw BusinessException', () => {
      expect(() => service.validateTransition('SIGNE', 'BROUILLON')).toThrow(BusinessException);
    });

    it('should reject BROUILLON -> SIGNE and throw BusinessException', () => {
      expect(() => service.validateTransition('BROUILLON', 'SIGNE')).toThrow(BusinessException);
    });

    it('should reject ANNULE -> BROUILLON and throw BusinessException', () => {
      expect(() => service.validateTransition('ANNULE', 'BROUILLON')).toThrow(BusinessException);
    });
  });

  describe('validateChantierTransition', () => {
    // Valid transitions
    it('should validate VISITE_TECHNIQUE -> DEVIS_EN_PREPARATION', () => {
      expect(() => service.validateChantierTransition('VISITE_TECHNIQUE', 'DEVIS_EN_PREPARATION')).not.toThrow();
    });

    it('should validate DEVIS_EN_PREPARATION -> DEVIS_ENVOYE', () => {
      expect(() => service.validateChantierTransition('DEVIS_EN_PREPARATION', 'DEVIS_ENVOYE')).not.toThrow();
    });

    it('should validate DEVIS_ENVOYE -> DEVIS_VALIDE', () => {
      expect(() => service.validateChantierTransition('DEVIS_ENVOYE', 'DEVIS_VALIDE')).not.toThrow();
    });

    it('should validate DEVIS_VALIDE -> PLANIFIE', () => {
      expect(() => service.validateChantierTransition('DEVIS_VALIDE', 'PLANIFIE')).not.toThrow();
    });

    it('should validate PLANIFIE -> DEMARRE', () => {
      expect(() => service.validateChantierTransition('PLANIFIE', 'DEMARRE')).not.toThrow();
    });

    it('should validate DEMARRE -> EN_COURS', () => {
      expect(() => service.validateChantierTransition('DEMARRE', 'EN_COURS')).not.toThrow();
    });

    it('should validate EN_COURS -> TERMINE', () => {
      expect(() => service.validateChantierTransition('EN_COURS', 'TERMINE')).not.toThrow();
    });

    it('should validate TERMINE -> CLOTURE', () => {
      expect(() => service.validateChantierTransition('TERMINE', 'CLOTURE')).not.toThrow();
    });

    // Invalid transitions (should throw BusinessException)
    it('should reject CLOTURE -> PLANIFIE and throw BusinessException', () => {
      expect(() => service.validateChantierTransition('CLOTURE', 'PLANIFIE')).toThrow(BusinessException);
    });

    it('should reject PLANIFIE -> CLOTURE and throw BusinessException', () => {
      expect(() => service.validateChantierTransition('PLANIFIE', 'CLOTURE')).toThrow(BusinessException);
    });

    it('should reject ANNULE -> VISITE_TECHNIQUE and throw BusinessException', () => {
      expect(() => service.validateChantierTransition('ANNULE', 'VISITE_TECHNIQUE')).toThrow(BusinessException);
    });
  });
});
