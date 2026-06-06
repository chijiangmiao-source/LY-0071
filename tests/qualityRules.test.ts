import { describe, it, expect } from 'vitest';
import {
  getLatestInspection,
  hasActiveRework,
  getActiveRework,
  needsQualityInspection,
  hasPassedLatestInspection,
  getQualityStatus,
  getReworkCount,
  canStartRework,
  canCompleteRework
} from '../src/lib/domain/qualityRules';
import type { Model, Step, QualityInspection, ReworkRecord } from '../src/lib/types';

const createMockModel = (overrides: Partial<Model> = {}): Model => ({
  id: 'm1',
  modelNo: 'M001',
  patientName: '测试患者',
  dentureType: 'CROWN',
  impressionDate: '2025-01-01',
  expectedDeliveryDate: '2025-01-10',
  responsiblePerson: '张三',
  status: 'IN_PROGRESS',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  reminded: false,
  deliveryDateHistory: [],
  ...overrides
});

const createMockStep = (overrides: Partial<Step> = {}): Step => ({
  id: 's1',
  modelId: 'm1',
  name: '测试步骤',
  responsiblePerson: '张三',
  plannedDate: '2025-01-05',
  completed: false,
  ...overrides
});

describe('qualityRules - 质检验收与返工规则', () => {
  describe('getLatestInspection', () => {
    it('空数组返回 undefined', () => {
      expect(getLatestInspection([])).toBeUndefined();
    });

    it('返回最新创建的质检记录', () => {
      const inspections: QualityInspection[] = [
        {
          id: 'q1', modelId: 'm1', inspector: 'A', inspectionDate: '2025-01-05',
          result: 'FAIL', problemDescription: '问题1', reworkRequirements: '返工1',
          createdAt: '2025-01-05T10:00:00Z'
        },
        {
          id: 'q2', modelId: 'm1', inspector: 'B', inspectionDate: '2025-01-06',
          result: 'PASS',
          createdAt: '2025-01-06T10:00:00Z'
        }
      ];
      const latest = getLatestInspection(inspections);
      expect(latest?.id).toBe('q2');
      expect(latest?.result).toBe('PASS');
    });
  });

  describe('hasActiveRework', () => {
    it('没有进行中的返工返回 false', () => {
      const records: ReworkRecord[] = [
        {
          id: 'r1', modelId: 'm1', inspectionId: 'q1', reworkStepId: 's1',
          reworkStepName: '步骤1', reworkResponsiblePerson: '张三',
          status: 'COMPLETED', startedAt: '2025-01-05T00:00:00Z',
          completedAt: '2025-01-06T00:00:00Z', completedBy: '李四'
        }
      ];
      expect(hasActiveRework(records)).toBe(false);
    });

    it('有进行中的返工返回 true', () => {
      const records: ReworkRecord[] = [
        {
          id: 'r1', modelId: 'm1', inspectionId: 'q1', reworkStepId: 's1',
          reworkStepName: '步骤1', reworkResponsiblePerson: '张三',
          status: 'IN_PROGRESS', startedAt: '2025-01-05T00:00:00Z'
        }
      ];
      expect(hasActiveRework(records)).toBe(true);
    });
  });

  describe('getActiveRework', () => {
    it('没有进行中的返工返回 undefined', () => {
      expect(getActiveRework([])).toBeUndefined();
    });

    it('返回进行中的返工记录', () => {
      const records: ReworkRecord[] = [
        {
          id: 'r1', modelId: 'm1', inspectionId: 'q1', reworkStepId: 's1',
          reworkStepName: '步骤1', reworkResponsiblePerson: '张三',
          status: 'IN_PROGRESS', startedAt: '2025-01-05T00:00:00Z'
        }
      ];
      const active = getActiveRework(records);
      expect(active?.id).toBe('r1');
      expect(active?.status).toBe('IN_PROGRESS');
    });
  });

  describe('needsQualityInspection', () => {
    it('已取消或已交付模型不需要质检', () => {
      const cancelled = createMockModel({ status: 'CANCELLED' });
      const delivered = createMockModel({ status: 'DELIVERED' });
      expect(needsQualityInspection(cancelled, [])).toBe(false);
      expect(needsQualityInspection(delivered, [])).toBe(false);
    });

    it('所有步骤完成时需要质检', () => {
      const model = createMockModel({ status: 'IN_PROGRESS' });
      const steps = [createMockStep({ completed: true })];
      expect(needsQualityInspection(model, steps)).toBe(true);
    });

    it('状态为 TRIAL 时需要质检', () => {
      const model = createMockModel({ status: 'TRIAL' });
      expect(needsQualityInspection(model, [])).toBe(true);
    });

    it('步骤未完成且状态非 TRIAL 不需要质检', () => {
      const model = createMockModel({ status: 'IN_PROGRESS' });
      const steps = [createMockStep({ completed: false })];
      expect(needsQualityInspection(model, steps)).toBe(false);
    });
  });

  describe('hasPassedLatestInspection', () => {
    it('没有质检记录返回 false', () => {
      expect(hasPassedLatestInspection([])).toBe(false);
    });

    it('最新质检通过返回 true', () => {
      const inspections: QualityInspection[] = [
        {
          id: 'q1', modelId: 'm1', inspector: 'A', inspectionDate: '2025-01-05',
          result: 'PASS', createdAt: '2025-01-05T10:00:00Z'
        }
      ];
      expect(hasPassedLatestInspection(inspections)).toBe(true);
    });

    it('最新质检不通过返回 false', () => {
      const inspections: QualityInspection[] = [
        {
          id: 'q1', modelId: 'm1', inspector: 'A', inspectionDate: '2025-01-05',
          result: 'FAIL', problemDescription: '问题', reworkRequirements: '返工',
          createdAt: '2025-01-05T10:00:00Z'
        }
      ];
      expect(hasPassedLatestInspection(inspections)).toBe(false);
    });
  });

  describe('getQualityStatus', () => {
    it('已取消或已交付模型返回 NONE', () => {
      const cancelled = createMockModel({ status: 'CANCELLED' });
      const delivered = createMockModel({ status: 'DELIVERED' });
      expect(getQualityStatus(cancelled, [], [], [])).toBe('NONE');
      expect(getQualityStatus(delivered, [], [], [])).toBe('NONE');
    });

    it('有进行中的返工返回 PENDING', () => {
      const model = createMockModel({ status: 'IN_PROGRESS' });
      const steps = [createMockStep({ completed: true })];
      const reworks: ReworkRecord[] = [
        {
          id: 'r1', modelId: 'm1', inspectionId: 'q1', reworkStepId: 's1',
          reworkStepName: '步骤1', reworkResponsiblePerson: '张三',
          status: 'IN_PROGRESS', startedAt: '2025-01-05T00:00:00Z'
        }
      ];
      expect(getQualityStatus(model, steps, [], reworks)).toBe('PENDING');
    });

    it('所有步骤完成但无质检记录返回 PENDING', () => {
      const model = createMockModel({ status: 'IN_PROGRESS' });
      const steps = [createMockStep({ completed: true })];
      expect(getQualityStatus(model, steps, [], [])).toBe('PENDING');
    });

    it('最新质检不通过返回 FAILED', () => {
      const model = createMockModel({ status: 'IN_PROGRESS' });
      const steps = [createMockStep({ completed: true })];
      const inspections: QualityInspection[] = [
        {
          id: 'q1', modelId: 'm1', inspector: 'A', inspectionDate: '2025-01-05',
          result: 'FAIL', problemDescription: '问题', reworkRequirements: '返工',
          createdAt: '2025-01-05T10:00:00Z'
        }
      ];
      expect(getQualityStatus(model, steps, inspections, [])).toBe('FAILED');
    });

    it('最新质检通过返回 PASSED_PENDING_DELIVERY', () => {
      const model = createMockModel({ status: 'IN_PROGRESS' });
      const steps = [createMockStep({ completed: true })];
      const inspections: QualityInspection[] = [
        {
          id: 'q1', modelId: 'm1', inspector: 'A', inspectionDate: '2025-01-05',
          result: 'PASS', createdAt: '2025-01-05T10:00:00Z'
        }
      ];
      expect(getQualityStatus(model, steps, inspections, [])).toBe('PASSED_PENDING_DELIVERY');
    });
  });

  describe('getReworkCount', () => {
    it('返回质检不通过的次数', () => {
      const inspections: QualityInspection[] = [
        {
          id: 'q1', modelId: 'm1', inspector: 'A', inspectionDate: '2025-01-05',
          result: 'FAIL', problemDescription: '问题1', reworkRequirements: '返工1',
          createdAt: '2025-01-05T10:00:00Z'
        },
        {
          id: 'q2', modelId: 'm1', inspector: 'B', inspectionDate: '2025-01-06',
          result: 'FAIL', problemDescription: '问题2', reworkRequirements: '返工2',
          createdAt: '2025-01-06T10:00:00Z'
        },
        {
          id: 'q3', modelId: 'm1', inspector: 'C', inspectionDate: '2025-01-07',
          result: 'PASS', createdAt: '2025-01-07T10:00:00Z'
        }
      ];
      expect(getReworkCount(inspections)).toBe(2);
    });
  });

  describe('canStartRework', () => {
    it('已取消或已交付模型不能发起返工', () => {
      const cancelled = createMockModel({ status: 'CANCELLED' });
      const result1 = canStartRework(cancelled, [], []);
      expect(result1.valid).toBe(false);

      const delivered = createMockModel({ status: 'DELIVERED' });
      const result2 = canStartRework(delivered, [], []);
      expect(result2.valid).toBe(false);
    });

    it('已有进行中的返工不能再发起', () => {
      const model = createMockModel({ status: 'IN_PROGRESS' });
      const inspections: QualityInspection[] = [
        {
          id: 'q1', modelId: 'm1', inspector: 'A', inspectionDate: '2025-01-05',
          result: 'FAIL', problemDescription: '问题', reworkRequirements: '返工',
          createdAt: '2025-01-05T10:00:00Z'
        }
      ];
      const reworks: ReworkRecord[] = [
        {
          id: 'r1', modelId: 'm1', inspectionId: 'q1', reworkStepId: 's1',
          reworkStepName: '步骤1', reworkResponsiblePerson: '张三',
          status: 'IN_PROGRESS', startedAt: '2025-01-05T00:00:00Z'
        }
      ];
      const result = canStartRework(model, inspections, reworks);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('进行中的返工');
    });

    it('没有质检记录不能发起返工', () => {
      const model = createMockModel({ status: 'IN_PROGRESS' });
      const result = canStartRework(model, [], []);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('请先完成质检记录');
    });

    it('最新质检通过不能发起返工', () => {
      const model = createMockModel({ status: 'IN_PROGRESS' });
      const inspections: QualityInspection[] = [
        {
          id: 'q1', modelId: 'm1', inspector: 'A', inspectionDate: '2025-01-05',
          result: 'PASS', createdAt: '2025-01-05T10:00:00Z'
        }
      ];
      const result = canStartRework(model, inspections, []);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('已通过');
    });

    it('最新质检不通过且无进行中返工可以发起', () => {
      const model = createMockModel({ status: 'IN_PROGRESS' });
      const inspections: QualityInspection[] = [
        {
          id: 'q1', modelId: 'm1', inspector: 'A', inspectionDate: '2025-01-05',
          result: 'FAIL', problemDescription: '问题', reworkRequirements: '返工',
          createdAt: '2025-01-05T10:00:00Z'
        }
      ];
      const result = canStartRework(model, inspections, []);
      expect(result.valid).toBe(true);
    });
  });

  describe('canCompleteRework', () => {
    it('没有返工记录不能完成', () => {
      const result = canCompleteRework(undefined);
      expect(result.valid).toBe(false);
    });

    it('已完成的返工不能重复完成', () => {
      const rework: ReworkRecord = {
        id: 'r1', modelId: 'm1', inspectionId: 'q1', reworkStepId: 's1',
        reworkStepName: '步骤1', reworkResponsiblePerson: '张三',
        status: 'COMPLETED', startedAt: '2025-01-05T00:00:00Z',
        completedAt: '2025-01-06T00:00:00Z', completedBy: '李四'
      };
      const result = canCompleteRework(rework);
      expect(result.valid).toBe(false);
    });

    it('进行中的返工可以完成', () => {
      const rework: ReworkRecord = {
        id: 'r1', modelId: 'm1', inspectionId: 'q1', reworkStepId: 's1',
        reworkStepName: '步骤1', reworkResponsiblePerson: '张三',
        status: 'IN_PROGRESS', startedAt: '2025-01-05T00:00:00Z'
      };
      const result = canCompleteRework(rework);
      expect(result.valid).toBe(true);
    });
  });
});
