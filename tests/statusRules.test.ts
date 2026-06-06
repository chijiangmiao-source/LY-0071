import { describe, it, expect } from 'vitest';
import {
  isFinalStatus,
  isActiveStatus,
  canTransitionTo,
  canMarkDelivered,
  areAllStepsCompleted
} from '../src/lib/domain/statusRules';
import type { Step, QualityInspection } from '../src/lib/types';

describe('statusRules - 状态流转规则', () => {
  describe('isFinalStatus', () => {
    it('DELIVERED 和 CANCELLED 应为终态', () => {
      expect(isFinalStatus('DELIVERED')).toBe(true);
      expect(isFinalStatus('CANCELLED')).toBe(true);
    });

    it('其他状态不应为终态', () => {
      expect(isFinalStatus('PENDING')).toBe(false);
      expect(isFinalStatus('IN_PROGRESS')).toBe(false);
      expect(isFinalStatus('TRIAL')).toBe(false);
    });
  });

  describe('isActiveStatus', () => {
    it('终态状态不是活动状态', () => {
      expect(isActiveStatus('DELIVERED')).toBe(false);
      expect(isActiveStatus('CANCELLED')).toBe(false);
    });

    it('非终态状态是活动状态', () => {
      expect(isActiveStatus('PENDING')).toBe(true);
      expect(isActiveStatus('IN_PROGRESS')).toBe(true);
      expect(isActiveStatus('TRIAL')).toBe(true);
    });
  });

  describe('areAllStepsCompleted', () => {
    it('空步骤列表应返回 false', () => {
      expect(areAllStepsCompleted([])).toBe(false);
    });

    it('所有步骤完成应返回 true', () => {
      const steps: Step[] = [
        { id: '1', modelId: 'm1', name: '步骤1', responsiblePerson: '张三', plannedDate: '2025-01-01', completed: true },
        { id: '2', modelId: 'm1', name: '步骤2', responsiblePerson: '李四', plannedDate: '2025-01-02', completed: true }
      ];
      expect(areAllStepsCompleted(steps)).toBe(true);
    });

    it('有未完成步骤应返回 false', () => {
      const steps: Step[] = [
        { id: '1', modelId: 'm1', name: '步骤1', responsiblePerson: '张三', plannedDate: '2025-01-01', completed: true },
        { id: '2', modelId: 'm1', name: '步骤2', responsiblePerson: '李四', plannedDate: '2025-01-02', completed: false }
      ];
      expect(areAllStepsCompleted(steps)).toBe(false);
    });
  });

  describe('canMarkDelivered', () => {
    it('没有步骤时不能交付', () => {
      const result = canMarkDelivered([]);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('请先添加制作步骤');
    });

    it('有未完成步骤时不能交付', () => {
      const steps: Step[] = [
        { id: '1', modelId: 'm1', name: '步骤1', responsiblePerson: '张三', plannedDate: '2025-01-01', completed: true },
        { id: '2', modelId: 'm1', name: '步骤2', responsiblePerson: '李四', plannedDate: '2025-01-02', completed: false }
      ];
      const result = canMarkDelivered(steps);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('还有 1 个步骤未完成');
    });

    it('所有步骤完成但没有质检记录不能交付', () => {
      const steps: Step[] = [
        { id: '1', modelId: 'm1', name: '步骤1', responsiblePerson: '张三', plannedDate: '2025-01-01', completed: true }
      ];
      const result = canMarkDelivered(steps, []);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('请先完成质检记录');
    });

    it('质检不通过不能交付', () => {
      const steps: Step[] = [
        { id: '1', modelId: 'm1', name: '步骤1', responsiblePerson: '张三', plannedDate: '2025-01-01', completed: true }
      ];
      const inspections: QualityInspection[] = [
        {
          id: 'q1',
          modelId: 'm1',
          inspector: '质检人',
          inspectionDate: '2025-01-05',
          result: 'FAIL',
          problemDescription: '有问题',
          reworkRequirements: '返工',
          createdAt: '2025-01-05T10:00:00Z'
        }
      ];
      const result = canMarkDelivered(steps, inspections);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('最近一次质检未通过');
    });

    it('所有步骤完成且最新质检通过可以交付', () => {
      const steps: Step[] = [
        { id: '1', modelId: 'm1', name: '步骤1', responsiblePerson: '张三', plannedDate: '2025-01-01', completed: true }
      ];
      const inspections: QualityInspection[] = [
        {
          id: 'q1',
          modelId: 'm1',
          inspector: '质检人',
          inspectionDate: '2025-01-05',
          result: 'FAIL',
          problemDescription: '有问题',
          reworkRequirements: '返工',
          createdAt: '2025-01-05T10:00:00Z'
        },
        {
          id: 'q2',
          modelId: 'm1',
          inspector: '质检人',
          inspectionDate: '2025-01-06',
          result: 'PASS',
          createdAt: '2025-01-06T10:00:00Z'
        }
      ];
      const result = canMarkDelivered(steps, inspections);
      expect(result.valid).toBe(true);
    });
  });

  describe('canTransitionTo', () => {
    it('非 DELIVERED 状态流转总是允许', () => {
      const result = canTransitionTo('PENDING', 'IN_PROGRESS', []);
      expect(result.valid).toBe(true);
    });

    it('流转到 DELIVERED 需要满足交付条件', () => {
      const steps: Step[] = [
        { id: '1', modelId: 'm1', name: '步骤1', responsiblePerson: '张三', plannedDate: '2025-01-01', completed: false }
      ];
      const result = canTransitionTo('IN_PROGRESS', 'DELIVERED', steps);
      expect(result.valid).toBe(false);
    });
  });
});
