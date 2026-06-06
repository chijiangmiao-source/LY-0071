import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isOverdue,
  getDeliveryStatus,
  getDeliveryStatusInfo,
  isUpcoming,
  shouldShowAlert,
  canMarkReminded,
  canReschedule,
  isModelActive
} from '../src/lib/domain/deliveryRules';
import type { Model } from '../src/lib/types';

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
  reminderDays: 3,
  ...overrides
});

describe('deliveryRules - 交付提醒与延期规则', () => {
  describe('isOverdue', () => {
    it('已交付或已取消的模型不视为逾期', () => {
      const delivered = createMockModel({ status: 'DELIVERED', expectedDeliveryDate: '2020-01-01' });
      const cancelled = createMockModel({ status: 'CANCELLED', expectedDeliveryDate: '2020-01-01' });
      expect(isOverdue(delivered.expectedDeliveryDate, delivered.status)).toBe(false);
      expect(isOverdue(cancelled.expectedDeliveryDate, cancelled.status)).toBe(false);
    });

    it('交付日期早于今天视为逾期', () => {
      expect(isOverdue('2020-01-01', 'IN_PROGRESS')).toBe(true);
    });

    it('交付日期等于或晚于今天不视为逾期', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(isOverdue(today, 'IN_PROGRESS')).toBe(false);
      expect(isOverdue('2099-12-31', 'IN_PROGRESS')).toBe(false);
    });
  });

  describe('getDeliveryStatus', () => {
    it('已交付或已取消返回 NORMAL', () => {
      expect(getDeliveryStatus('2020-01-01', 'DELIVERED', 3)).toBe('NORMAL');
      expect(getDeliveryStatus('2020-01-01', 'CANCELLED', 3)).toBe('NORMAL');
    });

    it('逾期返回 OVERDUE', () => {
      expect(getDeliveryStatus('2020-01-01', 'IN_PROGRESS', 3)).toBe('OVERDUE');
    });

    it('在提醒天数内返回 UPCOMING', () => {
      const date = new Date();
      date.setDate(date.getDate() + 2);
      const dateStr = date.toISOString().split('T')[0];
      expect(getDeliveryStatus(dateStr, 'IN_PROGRESS', 3)).toBe('UPCOMING');
    });

    it('超过提醒天数返回 NORMAL', () => {
      const date = new Date();
      date.setDate(date.getDate() + 10);
      const dateStr = date.toISOString().split('T')[0];
      expect(getDeliveryStatus(dateStr, 'IN_PROGRESS', 3)).toBe('NORMAL');
    });
  });

  describe('getDeliveryStatusInfo', () => {
    it('返回完整的交付状态信息', () => {
      const overdueModel = createMockModel({
        status: 'IN_PROGRESS',
        expectedDeliveryDate: '2020-01-01'
      });
      const info = getDeliveryStatusInfo(overdueModel);
      expect(info.status).toBe('OVERDUE');
      expect(info.isOverdue).toBe(true);
      expect(info.isUpcoming).toBe(false);
      expect(typeof info.remainingDays).toBe('number');
    });
  });

  describe('isUpcoming', () => {
    it('在提醒天数内且未逾期返回 true', () => {
      const date = new Date();
      date.setDate(date.getDate() + 1);
      const dateStr = date.toISOString().split('T')[0];
      expect(isUpcoming(dateStr, 'IN_PROGRESS', 3)).toBe(true);
    });

    it('逾期或超过提醒天数返回 false', () => {
      expect(isUpcoming('2020-01-01', 'IN_PROGRESS', 3)).toBe(false);
      const date = new Date();
      date.setDate(date.getDate() + 30);
      const dateStr = date.toISOString().split('T')[0];
      expect(isUpcoming(dateStr, 'IN_PROGRESS', 3)).toBe(false);
    });
  });

  describe('shouldShowAlert', () => {
    it('逾期或即将到期返回 true', () => {
      const overdue = createMockModel({
        status: 'IN_PROGRESS',
        expectedDeliveryDate: '2020-01-01'
      });
      expect(shouldShowAlert(overdue)).toBe(true);
    });

    it('正常状态返回 false', () => {
      const date = new Date();
      date.setDate(date.getDate() + 30);
      const normal = createMockModel({
        status: 'IN_PROGRESS',
        expectedDeliveryDate: date.toISOString().split('T')[0]
      });
      expect(shouldShowAlert(normal)).toBe(false);
    });
  });

  describe('canMarkReminded', () => {
    it('已交付或已取消的模型不能标记提醒', () => {
      const delivered = createMockModel({ status: 'DELIVERED' });
      const cancelled = createMockModel({ status: 'CANCELLED' });
      expect(canMarkReminded(delivered).valid).toBe(false);
      expect(canMarkReminded(cancelled).valid).toBe(false);
    });

    it('已标记提醒的模型不能重复标记', () => {
      const model = createMockModel({ reminded: true });
      expect(canMarkReminded(model).valid).toBe(false);
    });

    it('活动状态且未提醒的模型可以标记', () => {
      const model = createMockModel({ status: 'IN_PROGRESS', reminded: false });
      expect(canMarkReminded(model).valid).toBe(true);
    });
  });

  describe('canReschedule', () => {
    it('已交付或已取消的模型不能重新约定日期', () => {
      const delivered = createMockModel({ status: 'DELIVERED' });
      const cancelled = createMockModel({ status: 'CANCELLED' });
      expect(canReschedule(delivered).valid).toBe(false);
      expect(canReschedule(cancelled).valid).toBe(false);
    });

    it('活动状态的模型可以重新约定日期', () => {
      const model = createMockModel({ status: 'IN_PROGRESS' });
      expect(canReschedule(model).valid).toBe(true);
    });
  });

  describe('isModelActive', () => {
    it('已交付或已取消不是活动模型', () => {
      const delivered = createMockModel({ status: 'DELIVERED' });
      const cancelled = createMockModel({ status: 'CANCELLED' });
      expect(isModelActive(delivered)).toBe(false);
      expect(isModelActive(cancelled)).toBe(false);
    });

    it('其他状态是活动模型', () => {
      const pending = createMockModel({ status: 'PENDING' });
      const inProgress = createMockModel({ status: 'IN_PROGRESS' });
      const trial = createMockModel({ status: 'TRIAL' });
      expect(isModelActive(pending)).toBe(true);
      expect(isModelActive(inProgress)).toBe(true);
      expect(isModelActive(trial)).toBe(true);
    });
  });
});
