import { describe, it, expect } from 'vitest';
import {
  validateBatchAction,
  getActionFieldName,
  getActionNewValue
} from '../src/lib/domain/batchRules';
import type { Model, Step, QualityInspection } from '../src/lib/types';
import type { BatchValidationContext } from '../src/lib/domain/types';

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

const createContext = (overrides: Partial<BatchValidationContext> = {}): BatchValidationContext => ({
  model: createMockModel(),
  steps: [],
  inspections: [],
  ...overrides
});

describe('batchRules - 批量操作规则', () => {
  describe('validateBatchAction - SET_RESPONSIBLE_PERSON', () => {
    it('负责人为空返回失败', () => {
      const ctx = createContext();
      const result = validateBatchAction('SET_RESPONSIBLE_PERSON', { responsiblePerson: '' }, ctx);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('不能为空');
    });

    it('负责人包含非法字符返回失败', () => {
      const ctx = createContext();
      const result = validateBatchAction('SET_RESPONSIBLE_PERSON', { responsiblePerson: '张@三' }, ctx);
      expect(result.valid).toBe(false);
    });

    it('合法负责人返回成功', () => {
      const ctx = createContext();
      const result = validateBatchAction('SET_RESPONSIBLE_PERSON', { responsiblePerson: '张三' }, ctx);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateBatchAction - SET_EXPECTED_DELIVERY_DATE', () => {
    it('日期为空返回失败', () => {
      const ctx = createContext();
      const result = validateBatchAction('SET_EXPECTED_DELIVERY_DATE', { expectedDeliveryDate: '' }, ctx);
      expect(result.valid).toBe(false);
    });

    it('日期早于取模日期返回失败', () => {
      const ctx = createContext();
      const result = validateBatchAction(
        'SET_EXPECTED_DELIVERY_DATE',
        { expectedDeliveryDate: '2024-12-01' },
        ctx
      );
      expect(result.valid).toBe(false);
      expect(result.message).toContain('早于取模日期');
    });

    it('已交付模型不能修改交付日期', () => {
      const ctx = createContext({ model: createMockModel({ status: 'DELIVERED' }) });
      const result = validateBatchAction(
        'SET_EXPECTED_DELIVERY_DATE',
        { expectedDeliveryDate: '2025-02-01' },
        ctx
      );
      expect(result.valid).toBe(false);
    });

    it('合法日期返回成功', () => {
      const ctx = createContext();
      const result = validateBatchAction(
        'SET_EXPECTED_DELIVERY_DATE',
        { expectedDeliveryDate: '2025-02-01' },
        ctx
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('validateBatchAction - SET_REMINDER_DAYS', () => {
    it('非法天数返回失败', () => {
      const ctx = createContext();
      const result = validateBatchAction('SET_REMINDER_DAYS', { reminderDays: 5 }, ctx);
      expect(result.valid).toBe(false);
    });

    it('合法天数（1、3、7）返回成功', () => {
      const ctx = createContext();
      for (const days of [1, 3, 7]) {
        const result = validateBatchAction('SET_REMINDER_DAYS', { reminderDays: days }, ctx);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('validateBatchAction - MARK_REMINDED', () => {
    it('已交付或已取消的模型不能标记', () => {
      const ctx1 = createContext({ model: createMockModel({ status: 'DELIVERED' }) });
      const ctx2 = createContext({ model: createMockModel({ status: 'CANCELLED' }) });
      expect(validateBatchAction('MARK_REMINDED', {}, ctx1).valid).toBe(false);
      expect(validateBatchAction('MARK_REMINDED', {}, ctx2).valid).toBe(false);
    });

    it('已标记提醒的模型不能重复标记', () => {
      const ctx = createContext({ model: createMockModel({ reminded: true }) });
      const result = validateBatchAction('MARK_REMINDED', {}, ctx);
      expect(result.valid).toBe(false);
    });

    it('合法模型返回成功', () => {
      const ctx = createContext({ model: createMockModel({ status: 'IN_PROGRESS', reminded: false }) });
      const result = validateBatchAction('MARK_REMINDED', {}, ctx);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateBatchAction - SET_FLOW_STATUS', () => {
    it('目标状态为空返回失败', () => {
      const ctx = createContext();
      const result = validateBatchAction('SET_FLOW_STATUS', { status: '' }, ctx);
      expect(result.valid).toBe(false);
    });

    it('流转到 DELIVERED 需要满足条件', () => {
      const steps: Step[] = [
        { id: 's1', modelId: 'm1', name: '步骤1', responsiblePerson: '张三', plannedDate: '2025-01-05', completed: false }
      ];
      const ctx = createContext({ steps });
      const result = validateBatchAction('SET_FLOW_STATUS', { status: 'DELIVERED' }, ctx);
      expect(result.valid).toBe(false);
    });

    it('非 DELIVERED 状态流转总是允许', () => {
      const ctx = createContext();
      const result = validateBatchAction('SET_FLOW_STATUS', { status: 'IN_PROGRESS' }, ctx);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateBatchAction - EXPORT_SUMMARY', () => {
    it('总是返回成功', () => {
      const ctx = createContext();
      const result = validateBatchAction('EXPORT_SUMMARY', {}, ctx);
      expect(result.valid).toBe(true);
    });
  });

  describe('getActionFieldName', () => {
    it('返回正确的字段名', () => {
      expect(getActionFieldName('SET_RESPONSIBLE_PERSON')).toBe('负责人');
      expect(getActionFieldName('SET_EXPECTED_DELIVERY_DATE')).toBe('预计交付日期');
      expect(getActionFieldName('SET_REMINDER_DAYS')).toBe('提醒天数');
      expect(getActionFieldName('MARK_REMINDED')).toBe('提醒状态');
      expect(getActionFieldName('SET_FLOW_STATUS')).toBe('流转状态');
      expect(getActionFieldName('EXPORT_SUMMARY')).toBe('导出摘要');
    });
  });

  describe('getActionNewValue', () => {
    it('MARK_REMINDED 固定返回 true', () => {
      expect(getActionNewValue('MARK_REMINDED', {})).toBe(true);
    });

    it('正确返回对应 payload 中的值', () => {
      expect(getActionNewValue('SET_RESPONSIBLE_PERSON', { responsiblePerson: '张三' })).toBe('张三');
      expect(getActionNewValue('SET_REMINDER_DAYS', { reminderDays: 3 })).toBe(3);
      expect(getActionNewValue('SET_FLOW_STATUS', { status: 'IN_PROGRESS' })).toBe('IN_PROGRESS');
    });

    it('EXPORT_SUMMARY 返回 null', () => {
      expect(getActionNewValue('EXPORT_SUMMARY', {})).toBeNull();
    });
  });
});
