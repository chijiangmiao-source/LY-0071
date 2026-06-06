<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BatchActionType, FlowStatus, ReminderDays } from '$lib/types';
  import { BATCH_ACTION_TYPE_LABEL, FLOW_STATUS_LABEL, REMINDER_DAYS_OPTIONS, DEFAULT_REMINDER_DAYS } from '$lib/types';
  import { todayStr, isDateBeforeOrEqual } from '$lib/formatters';
  import { isValidName } from '$lib/validators';

  export let selectedCount: number = 0;
  export let impressionDates: Record<string, string> = {};

  const dispatch = createEventDispatcher<{
    execute: {
      actionType: BatchActionType;
      payload: Record<string, any>;
    };
    clearSelection: void;
  }>();

  let activeAction: BatchActionType | null = null;

  let responsiblePerson = '';
  let responsiblePersonError = '';

  let expectedDeliveryDate = '';
  let deliveryReason = '';
  let deliveryError = '';

  let reminderDays: ReminderDays = DEFAULT_REMINDER_DAYS;

  let flowStatus: FlowStatus = 'IN_PROGRESS';

  let showResult = false;
  let lastResult: { succeeded: number; failed: number; failureReasons: Record<string, string> } | null = null;

  const flowStatusOptions: { value: FlowStatus; label: string }[] = [
    { value: 'PENDING', label: FLOW_STATUS_LABEL.PENDING },
    { value: 'IN_PROGRESS', label: FLOW_STATUS_LABEL.IN_PROGRESS },
    { value: 'TRIAL', label: FLOW_STATUS_LABEL.TRIAL },
    { value: 'DELIVERED', label: FLOW_STATUS_LABEL.DELIVERED },
    { value: 'CANCELLED', label: FLOW_STATUS_LABEL.CANCELLED }
  ];

  function openAction(action: BatchActionType) {
    activeAction = action;
    responsiblePerson = '';
    responsiblePersonError = '';
    expectedDeliveryDate = '';
    deliveryReason = '';
    deliveryError = '';
    reminderDays = DEFAULT_REMINDER_DAYS;
    flowStatus = 'IN_PROGRESS';
  }

  function closeModal() {
    activeAction = null;
  }

  function getMinDeliveryDate(): string {
    const dates = Object.values(impressionDates);
    if (dates.length === 0) return todayStr();
    return dates.reduce((a, b) => (a < b ? a : b));
  }

  function handleSetResponsiblePerson() {
    responsiblePersonError = '';
    if (!responsiblePerson.trim()) {
      responsiblePersonError = '请填写负责人';
      return;
    }
    if (!isValidName(responsiblePerson)) {
      responsiblePersonError = '负责人只能包含中文、英文、数字和空格';
      return;
    }
    dispatch('execute', {
      actionType: 'SET_RESPONSIBLE_PERSON',
      payload: { responsiblePerson: responsiblePerson.trim() }
    });
    closeModal();
  }

  function handleSetDeliveryDate() {
    deliveryError = '';
    if (!expectedDeliveryDate) {
      deliveryError = '请选择预计交付日期';
      return;
    }
    const minDate = getMinDeliveryDate();
    if (!isDateBeforeOrEqual(minDate, expectedDeliveryDate)) {
      deliveryError = '预计交付日期不能早于所有已选模型的最早取模日期';
      return;
    }
    dispatch('execute', {
      actionType: 'SET_EXPECTED_DELIVERY_DATE',
      payload: {
        expectedDeliveryDate,
        reason: deliveryReason.trim() || '批量调整交付日期'
      }
    });
    closeModal();
  }

  function handleSetReminderDays() {
    dispatch('execute', {
      actionType: 'SET_REMINDER_DAYS',
      payload: { reminderDays }
    });
    closeModal();
  }

  function handleMarkReminded() {
    dispatch('execute', {
      actionType: 'MARK_REMINDED',
      payload: {}
    });
    closeModal();
  }

  function handleSetFlowStatus() {
    dispatch('execute', {
      actionType: 'SET_FLOW_STATUS',
      payload: { status: flowStatus }
    });
    closeModal();
  }

  function handleExportSummary() {
    dispatch('execute', {
      actionType: 'EXPORT_SUMMARY',
      payload: {}
    });
    closeModal();
  }

  export function showExecuteResult(result: { succeeded: number; failed: number; failureReasons: Record<string, string> }) {
    lastResult = result;
    showResult = true;
  }

  function closeResult() {
    showResult = false;
    lastResult = null;
  }
</script>

{#if selectedCount > 0}
  <div class="bg-gradient-to-r from-medical-blue-600 to-medical-blue-500 text-white rounded-2xl shadow-lg p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
    <div class="flex items-center gap-3 flex-wrap">
      <span class="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
        ✓ 已选择 {selectedCount} 个模型
      </span>
      <span class="text-sm text-blue-100">批量操作中心</span>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        on:click={() => openAction('SET_RESPONSIBLE_PERSON')}
        class="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
      >
        👤 设置负责人
      </button>
      <button
        type="button"
        on:click={() => openAction('SET_EXPECTED_DELIVERY_DATE')}
        class="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
      >
        📅 调整交付日期
      </button>
      <button
        type="button"
        on:click={() => openAction('SET_REMINDER_DAYS')}
        class="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
      >
        ⏰ 修改提醒天数
      </button>
      <button
        type="button"
        on:click={() => openAction('MARK_REMINDED')}
        class="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
      >
        ✅ 标记已提醒
      </button>
      <button
        type="button"
        on:click={() => openAction('SET_FLOW_STATUS')}
        class="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
      >
        🔄 变更状态
      </button>
      <button
        type="button"
        on:click={() => openAction('EXPORT_SUMMARY')}
        class="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
      >
        📤 导出摘要
      </button>
      <button
        type="button"
        on:click={() => dispatch('clearSelection')}
        class="px-3 py-1.5 bg-warning-red-500 hover:bg-warning-red-600 rounded-lg text-sm font-medium transition-colors"
      >
        取消选择
      </button>
    </div>
  </div>
{/if}

{#if activeAction === 'SET_RESPONSIBLE_PERSON'}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" on:click={closeModal}>
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" on:click|stopPropagation>
      <div class="flex items-start gap-4 mb-4">
        <div class="w-12 h-12 bg-medical-blue-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
          👤
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-bold text-slate-800 mb-1">批量设置负责人</h3>
          <p class="text-sm text-slate-500">将为已选的 {selectedCount} 个模型设置统一的负责人</p>
        </div>
      </div>
      <div class="space-y-4">
        <div>
          <label class="label-text">负责人 <span class="text-warning-red-500">*</span></label>
          <input
            type="text"
            bind:value={responsiblePerson}
            placeholder="请输入负责人姓名"
            class="input-field {responsiblePersonError ? 'border-warning-red-400' : ''}"
          />
          {#if responsiblePersonError}
            <p class="text-xs text-warning-red-500 mt-1">{responsiblePersonError}</p>
          {/if}
        </div>
      </div>
      <div class="flex gap-3 justify-end mt-5">
        <button on:click={closeModal} class="btn-secondary text-sm">取消</button>
        <button on:click={handleSetResponsiblePerson} class="btn-primary text-sm">确认执行</button>
      </div>
    </div>
  </div>
{/if}

{#if activeAction === 'SET_EXPECTED_DELIVERY_DATE'}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" on:click={closeModal}>
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" on:click|stopPropagation>
      <div class="flex items-start gap-4 mb-4">
        <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
          📅
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-bold text-slate-800 mb-1">批量调整预计交付日期</h3>
          <p class="text-sm text-slate-500">将为已选的 {selectedCount} 个模型设置新的预计交付日期</p>
        </div>
      </div>
      <div class="space-y-4">
        <div>
          <label class="label-text">新的预计交付日期 <span class="text-warning-red-500">*</span></label>
          <input
            type="date"
            bind:value={expectedDeliveryDate}
            min={getMinDeliveryDate()}
            class="input-field {deliveryError ? 'border-warning-red-400' : ''}"
          />
          {#if deliveryError}
            <p class="text-xs text-warning-red-500 mt-1">{deliveryError}</p>
          {:else}
            <p class="text-xs text-slate-400 mt-1">不能早于已选模型的最早取模日期（{getMinDeliveryDate()}）</p>
          {/if}
        </div>
        <div>
          <label class="label-text">调整原因（可选）</label>
          <textarea
            bind:value={deliveryReason}
            placeholder="请说明调整交付日期的原因"
            rows="3"
            class="input-field resize-none"
          ></textarea>
        </div>
      </div>
      <div class="flex gap-3 justify-end mt-5">
        <button on:click={closeModal} class="btn-secondary text-sm">取消</button>
        <button on:click={handleSetDeliveryDate} class="btn-primary text-sm">确认执行</button>
      </div>
    </div>
  </div>
{/if}

{#if activeAction === 'SET_REMINDER_DAYS'}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" on:click={closeModal}>
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" on:click|stopPropagation>
      <div class="flex items-start gap-4 mb-4">
        <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
          ⏰
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-bold text-slate-800 mb-1">批量修改提醒天数</h3>
          <p class="text-sm text-slate-500">将为已选的 {selectedCount} 个模型设置交付提前提醒天数</p>
        </div>
      </div>
      <div class="space-y-4">
        <div>
          <label class="label-text">提前提醒天数</label>
          <select bind:value={reminderDays} class="input-field">
            {#each REMINDER_DAYS_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="flex gap-3 justify-end mt-5">
        <button on:click={closeModal} class="btn-secondary text-sm">取消</button>
        <button on:click={handleSetReminderDays} class="btn-primary text-sm">确认执行</button>
      </div>
    </div>
  </div>
{/if}

{#if activeAction === 'MARK_REMINDED'}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" on:click={closeModal}>
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" on:click|stopPropagation>
      <div class="flex items-start gap-4 mb-4">
        <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
          ✅
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-bold text-slate-800 mb-1">批量标记已提醒</h3>
          <p class="text-sm text-slate-500">将为已选的 {selectedCount} 个模型标记为已提醒状态</p>
          <p class="text-xs text-amber-600 mt-2">⚠️ 已交付或已取消、以及已标记提醒的模型将被自动跳过</p>
        </div>
      </div>
      <div class="flex gap-3 justify-end mt-5">
        <button on:click={closeModal} class="btn-secondary text-sm">取消</button>
        <button on:click={handleMarkReminded} class="btn-primary text-sm">确认执行</button>
      </div>
    </div>
  </div>
{/if}

{#if activeAction === 'SET_FLOW_STATUS'}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" on:click={closeModal}>
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" on:click|stopPropagation>
      <div class="flex items-start gap-4 mb-4">
        <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
          🔄
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-bold text-slate-800 mb-1">批量变更流转状态</h3>
          <p class="text-sm text-slate-500">将为已选的 {selectedCount} 个模型变更流转状态</p>
          <p class="text-xs text-amber-600 mt-2">⚠️ 标记为「已交付」要求所有制作步骤完成且质检通过，不满足条件的模型将被自动跳过</p>
        </div>
      </div>
      <div class="space-y-4">
        <div>
          <label class="label-text">目标流转状态</label>
          <select bind:value={flowStatus} class="input-field">
            {#each flowStatusOptions as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="flex gap-3 justify-end mt-5">
        <button on:click={closeModal} class="btn-secondary text-sm">取消</button>
        <button on:click={handleSetFlowStatus} class="btn-primary text-sm">确认执行</button>
      </div>
    </div>
  </div>
{/if}

{#if activeAction === 'EXPORT_SUMMARY'}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" on:click={closeModal}>
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" on:click|stopPropagation>
      <div class="flex items-start gap-4 mb-4">
        <div class="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
          📤
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-bold text-slate-800 mb-1">批量导出模型摘要</h3>
          <p class="text-sm text-slate-500">将导出已选的 {selectedCount} 个模型的摘要信息为 TXT 文件</p>
        </div>
      </div>
      <div class="flex gap-3 justify-end mt-5">
        <button on:click={closeModal} class="btn-secondary text-sm">取消</button>
        <button on:click={handleExportSummary} class="btn-primary text-sm">确认导出</button>
      </div>
    </div>
  </div>
{/if}

{#if showResult && lastResult}
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" on:click={closeResult}>
    <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" on:click|stopPropagation>
      <div class="flex items-start gap-4 mb-4">
        <div class="w-12 h-12 {lastResult.failed > 0 ? 'bg-amber-100' : 'bg-green-100'} rounded-full flex items-center justify-center text-2xl flex-shrink-0">
          {lastResult.failed > 0 ? '⚠️' : '✅'}
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-bold text-slate-800 mb-1">批量操作完成</h3>
          <div class="flex gap-4 mt-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              ✓ 成功 {lastResult.succeeded} 个
            </span>
            {#if lastResult.failed > 0}
              <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-warning-red-100 text-warning-red-700 rounded-full text-sm font-medium">
                ✗ 失败 {lastResult.failed} 个
              </span>
            {/if}
          </div>
        </div>
      </div>
      {#if lastResult.failed > 0 && Object.keys(lastResult.failureReasons).length > 0}
        <div class="mt-4 bg-warning-red-50 border border-warning-red-200 rounded-xl p-4 max-h-64 overflow-y-auto">
          <h4 class="text-sm font-semibold text-warning-red-800 mb-2">失败详情</h4>
          <div class="space-y-1.5">
            {#each Object.entries(lastResult.failureReasons) as [id, reason]}
              <div class="text-xs text-warning-red-700 flex items-start gap-2">
                <span class="font-mono bg-white/60 px-1.5 py-0.5 rounded whitespace-nowrap">{id.slice(0, 8)}...</span>
                <span>{reason}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
      <div class="flex gap-3 justify-end mt-5">
        <button on:click={closeResult} class="btn-primary text-sm">知道了</button>
      </div>
    </div>
  </div>
{/if}
