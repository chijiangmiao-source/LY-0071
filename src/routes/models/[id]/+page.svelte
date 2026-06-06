<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import AppHeader from '$components/AppHeader.svelte';
  import StatusBadge from '$components/StatusBadge.svelte';
  import StepForm from '$components/StepForm.svelte';
  import QualityStatusBadge from '$components/QualityStatusBadge.svelte';
  import QualityInspectionForm from '$components/QualityInspectionForm.svelte';
  import {
    models,
    steps,
    addStep,
    updateStep,
    deleteStep,
    toggleStepComplete,
    updateModel,
    deleteModel,
    getModelById,
    getStepsByModelId,
    markAsReminded,
    rescheduleDeliveryDate,
    qualityInspections,
    addQualityInspection,
    getQualityInspectionsByModelId,
    getQualityStatus,
    reworkRecords,
    startRework,
    completeRework,
    getActiveRework,
    getReworkRecordsByModelId
  } from '$lib/store';
  import {
    validateModel,
    canTransitionTo,
    canMarkDelivered
  } from '$lib/validators';
  import type { FlowStatus, DentureType, Model, Step, ReminderDays, DeliveryDateHistory, QualityInspection, QualityStatus, InspectionResult, ReworkRecord, ReworkStatus } from '$lib/types';
  import { FLOW_STATUS_LABEL, DENTURE_TYPE_LABEL, DEFAULT_STEP_NAMES, REMINDER_DAYS_OPTIONS, DEFAULT_REMINDER_DAYS, INSPECTION_RESULT_LABEL, REWORK_STATUS_LABEL, REWORK_STATUS_COLOR } from '$lib/types';
  import { todayStr, formatDate, isOverdue, daysRemaining, getDeliveryStatus } from '$lib/formatters';
  import { get } from 'svelte/store';

  let modelId = '';
  let model: Model | null = null;
  let modelNo = '';
  let patientName = '';
  let dentureType: DentureType = 'CROWN';
  let impressionDate = todayStr();
  let expectedDeliveryDate = '';
  let responsiblePerson = '';
  let status: FlowStatus = 'PENDING';
  let reminderDays: ReminderDays = DEFAULT_REMINDER_DAYS;
  let reminded = false;
  let remindedAt = '';
  let delayReason = '';
  let deliveryDateHistory: DeliveryDateHistory[] = [];
  let errors: Record<string, string> = {};
  let saving = false;
  let editingStep: Step | null = null;
  let loaded = false;
  let showDeliverWarning = false;
  let deliverWarningMessage = '';
  let showDeleteConfirm = false;
  let deleting = false;
  let showRescheduleModal = false;
  let rescheduleNewDate = '';
  let rescheduleReason = '';
  let rescheduleErrors: Record<string, string> = {};
  let localInspections: QualityInspection[] = [];
  let latestInspection: QualityInspection | null = null;
  let qualityStatus: QualityStatus = 'NONE';
  let reworkCount = 0;
  let localReworkRecords: ReworkRecord[] = [];
  let activeRework: ReworkRecord | null = null;
  let showStartReworkModal = false;
  let showCompleteReworkModal = false;
  let reworkStepId = '';
  let reworkResponsiblePerson = '';
  let reworkErrors: Record<string, string> = {};
  let completeReworkBy = '';
  let completeReworkRemarks = '';
  let completeReworkErrors: Record<string, string> = {};

  $: modelId = $page.params.id ?? '';
  $: localSteps = $steps.filter((s) => s.modelId === modelId);
  $: {
    localInspections = $qualityInspections
      .filter((q) => q.modelId === modelId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    latestInspection = localInspections.length > 0 ? localInspections[0] : null;
    qualityStatus = model ? getQualityStatus(model) : 'NONE';
    reworkCount = localInspections.filter((q) => q.result === 'FAIL').length;
    localReworkRecords = $reworkRecords
      .filter((r) => r.modelId === modelId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    activeRework = localReworkRecords.find((r) => r.status === 'IN_PROGRESS') || null;
  }

  const dentureTypeOptions = Object.entries(DENTURE_TYPE_LABEL) as [DentureType, string][];

  onMount(() => {
    const found = getModelById(modelId);
    if (!found) {
      goto('/models');
      return;
    }
    model = found;
    modelNo = found.modelNo;
    patientName = found.patientName;
    dentureType = found.dentureType;
    impressionDate = found.impressionDate;
    expectedDeliveryDate = found.expectedDeliveryDate;
    responsiblePerson = found.responsiblePerson;
    status = found.status;
    reminderDays = found.reminderDays ?? DEFAULT_REMINDER_DAYS;
    reminded = found.reminded ?? false;
    remindedAt = found.remindedAt ?? '';
    delayReason = found.delayReason ?? '';
    deliveryDateHistory = found.deliveryDateHistory ?? [];
    loaded = true;
  });

  $: sortedSteps = [...localSteps].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime();
  });

  function handleAddStep(e: CustomEvent) {
    const data = e.detail;
    addStep({
      ...data,
      modelId,
      completed: false
    });
  }

  function handleUpdateStep(e: CustomEvent) {
    const { id, data } = e.detail;
    updateStep(id, data);
    editingStep = null;
  }

  function handleDeleteStep(id: string) {
    deleteStep(id);
  }

  function handleEditStep(step: Step) {
    editingStep = step;
  }

  function handleToggleComplete(id: string) {
    toggleStepComplete(id);
  }

  function onStatusChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const newStatus = target.value as FlowStatus;

    const check = canTransitionTo(status, newStatus, localSteps, localInspections);
    if (!check.valid) {
      showDeliverWarning = true;
      deliverWarningMessage = check.message || '';
      target.value = status;
      return;
    }
    status = newStatus;
    showDeliverWarning = false;
  }

  function handleAddQualityInspection(e: CustomEvent) {
    const data = e.detail as Omit<QualityInspection, 'id' | 'createdAt'>;
    addQualityInspection(data);
  }

  function openStartReworkModal() {
    reworkStepId = localSteps.length > 0 ? localSteps[0].id : '';
    reworkResponsiblePerson = responsiblePerson || '';
    reworkErrors = {};
    showStartReworkModal = true;
  }

  function handleStartReworkSubmit() {
    const errors: Record<string, string> = {};
    if (!reworkStepId) {
      errors.reworkStepId = '请选择返工工序';
    }
    if (!reworkResponsiblePerson.trim()) {
      errors.reworkResponsiblePerson = '请填写返工负责人';
    }
    if (Object.keys(errors).length > 0) {
      reworkErrors = errors;
      return;
    }
    const step = localSteps.find((s) => s.id === reworkStepId);
    if (!step || !latestInspection) return;
    startRework(modelId, latestInspection.id, step.id, step.name, reworkResponsiblePerson.trim());
    showStartReworkModal = false;
  }

  function openCompleteReworkModal() {
    completeReworkBy = responsiblePerson || '';
    completeReworkRemarks = '';
    completeReworkErrors = {};
    showCompleteReworkModal = true;
  }

  function handleCompleteReworkSubmit() {
    const errors: Record<string, string> = {};
    if (!completeReworkBy.trim()) {
      errors.completedBy = '请填写完成人';
    }
    if (Object.keys(errors).length > 0) {
      completeReworkErrors = errors;
      return;
    }
    if (!activeRework) return;
    completeRework(activeRework.id, completeReworkBy.trim(), completeReworkRemarks.trim());
    showCompleteReworkModal = false;
  }

  async function handleSubmit() {
    const data = {
      modelNo: modelNo.trim(),
      patientName: patientName.trim(),
      dentureType,
      impressionDate,
      expectedDeliveryDate,
      responsiblePerson: responsiblePerson.trim(),
      status,
      reminderDays,
      reminded,
      remindedAt: remindedAt || undefined,
      delayReason: delayReason.trim() || undefined,
      deliveryDateHistory
    };
    const result = validateModel(data, get(models), localSteps, modelId, localInspections);
    if (!result.valid) {
      errors = result.errors;
      return;
    }
    errors = {};
    saving = true;

    try {
      updateModel(modelId, data);
      goto('/models');
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    deleting = true;
    try {
      deleteModel(modelId);
      goto('/models');
    } finally {
      deleting = false;
    }
  }

  function handleMarkReminded() {
    markAsReminded(modelId);
    reminded = true;
    remindedAt = new Date().toISOString();
  }

  function openRescheduleModal() {
    rescheduleNewDate = expectedDeliveryDate;
    rescheduleReason = delayReason;
    rescheduleErrors = {};
    showRescheduleModal = true;
  }

  function handleRescheduleSubmit() {
    const errors: Record<string, string> = {};
    if (!rescheduleNewDate) {
      errors.newDate = '请选择新的交付日期';
    } else if (rescheduleNewDate <= expectedDeliveryDate) {
      errors.newDate = '新日期必须晚于当前预计交付日期';
    }
    if (!rescheduleReason || !rescheduleReason.trim()) {
      errors.reason = '请填写延期原因';
    }
    if (Object.keys(errors).length > 0) {
      rescheduleErrors = errors;
      return;
    }
    rescheduleDeliveryDate(modelId, rescheduleNewDate, rescheduleReason.trim(), responsiblePerson || '系统');
    expectedDeliveryDate = rescheduleNewDate;
    delayReason = rescheduleReason.trim();
    reminded = false;
    remindedAt = '';
    deliveryDateHistory = [...deliveryDateHistory, {
      id: 'tmp_' + Date.now(),
      previousDate: model?.expectedDeliveryDate || '',
      newDate: rescheduleNewDate,
      reason: rescheduleReason.trim(),
      changedAt: new Date().toISOString(),
      changedBy: responsiblePerson || '系统'
    }];
    showRescheduleModal = false;
  }

  $: completedCount = localSteps.filter((s) => s.completed).length;
  $: overdue = loaded && isOverdue(expectedDeliveryDate, status);
  $: remaining = daysRemaining(expectedDeliveryDate);
  $: deliveryStatus = loaded ? getDeliveryStatus(expectedDeliveryDate, status, reminderDays) : 'NORMAL';
  $: isUpcoming = deliveryStatus === 'UPCOMING';
  $: isOverdueStatus = deliveryStatus === 'OVERDUE';
</script>

<AppHeader />

{#if loaded && model}
  <main class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="mb-6 flex items-start justify-between flex-wrap gap-3">
      <div>
        <a href="/models" class="text-sm text-slate-500 hover:text-medical-blue-600 transition-colors">
          ← 返回模型列表
        </a>
        <div class="flex items-center gap-3 mt-1 flex-wrap">
          <h2 class="text-2xl font-bold text-slate-800">
            {patientName}
            <span class="text-sm font-mono text-slate-400 ml-2 bg-slate-100 px-2 py-0.5 rounded">
              {modelNo}
            </span>
          </h2>
          <StatusBadge status={status} size="md" />
          <QualityStatusBadge status={qualityStatus} size="md" />
          {#if isOverdueStatus}
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-warning-red-500 text-white text-sm font-medium rounded-full">
              ⚠️
              已延期 {Math.abs(remaining)} 天
            </span>
          {:else if isUpcoming}
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-amber-500 text-white text-sm font-medium rounded-full">
              ⏰
              {#if remaining === 0}
                今日到期
              {:else}
                剩余 {remaining} 天到期
              {/if}
            </span>
          {/if}
          {#if reminded}
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full border border-green-200">
              ✓ 已提醒
              {#if remindedAt}
                ({formatDate(remindedAt)})
              {/if}
            </span>
          {/if}
        </div>
        <p class="text-sm text-slate-500 mt-1">
          {DENTURE_TYPE_LABEL[dentureType]} · 负责人: {responsiblePerson}
        </p>
      </div>
      <button
        on:click={() => (showDeleteConfirm = true)}
        class="text-warning-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-warning-red-200"
      >
        🗑️ 删除模型
      </button>
    </div>

    <form on:submit|preventDefault={handleSubmit} class="space-y-6">
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>📋</span> 基本信息
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="label-text">
              模型编号 <span class="text-warning-red-500">*</span>
            </label>
            <input
              type="text"
              bind:value={modelNo}
              class="input-field {errors.modelNo ? 'border-warning-red-400' : ''}"
            />
            {#if errors.modelNo}
              <p class="text-xs text-warning-red-500 mt-1">{errors.modelNo}</p>
            {/if}
          </div>

          <div>
            <label class="label-text">
              患者姓名 <span class="text-warning-red-500">*</span>
            </label>
            <input
              type="text"
              bind:value={patientName}
              class="input-field {errors.patientName ? 'border-warning-red-400' : ''}"
            />
            {#if errors.patientName}
              <p class="text-xs text-warning-red-500 mt-1">{errors.patientName}</p>
            {/if}
          </div>

          <div>
            <label class="label-text">
              义齿类型 <span class="text-warning-red-500">*</span>
            </label>
            <select
              bind:value={dentureType}
              class="input-field {errors.dentureType ? 'border-warning-red-400' : ''}"
            >
              {#each dentureTypeOptions as [value, label]}
                <option value={value}>{label}</option>
              {/each}
            </select>
          </div>

          <div>
            <label class="label-text">
              负责人 <span class="text-warning-red-500">*</span>
            </label>
            <input
              type="text"
              bind:value={responsiblePerson}
              class="input-field {errors.responsiblePerson ? 'border-warning-red-400' : ''}"
            />
            {#if errors.responsiblePerson}
              <p class="text-xs text-warning-red-500 mt-1">{errors.responsiblePerson}</p>
            {/if}
          </div>

          <div>
            <label class="label-text">
              取模日期 <span class="text-warning-red-500">*</span>
            </label>
            <input
              type="date"
              bind:value={impressionDate}
              max={todayStr()}
              class="input-field {errors.impressionDate ? 'border-warning-red-400' : ''}"
            />
            {#if errors.impressionDate}
              <p class="text-xs text-warning-red-500 mt-1">{errors.impressionDate}</p>
            {/if}
          </div>

          <div>
            <label class="label-text">
              预计交付日期 <span class="text-warning-red-500">*</span>
            </label>
            <input
              type="date"
              bind:value={expectedDeliveryDate}
              min={impressionDate}
              class="input-field {errors.expectedDeliveryDate ? 'border-warning-red-400' : ''}"
            />
            {#if errors.expectedDeliveryDate}
              <p class="text-xs text-warning-red-500 mt-1">{errors.expectedDeliveryDate}</p>
            {/if}
          </div>

          <div class="md:col-span-2">
            <label class="label-text">
              流转状态 <span class="text-warning-red-500">*</span>
            </label>
            <select
              bind:value={status}
              on:change={onStatusChange}
              class="input-field"
            >
              {#each Object.entries(FLOW_STATUS_LABEL) as [value, label]}
                <option value={value}>{label}</option>
              {/each}
            </select>
            {#if showDeliverWarning}
              <div class="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                ⚠️ {deliverWarningMessage}
              </div>
            {/if}
          </div>

          <div>
            <label class="label-text">
              交付提醒设置
            </label>
            <select
              bind:value={reminderDays}
              class="input-field"
            >
              {#each REMINDER_DAYS_OPTIONS as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
            <p class="text-xs text-slate-400 mt-1">在预计交付日前多少天开始提醒</p>
          </div>

          <div>
            <label class="label-text">
              延期原因（可选）
            </label>
            <input
              type="text"
              bind:value={delayReason}
              placeholder="如有延期请说明原因"
              class="input-field"
            />
          </div>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>🔔</span> 交付提醒与延期处理
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <button
                type="button"
                on:click={handleMarkReminded}
                disabled={reminded || status === 'DELIVERED' || status === 'CANCELLED'}
                class="px-4 py-2 bg-medical-blue-500 text-white rounded-lg text-sm font-medium hover:bg-medical-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reminded ? '✓ 已标记提醒' : '标记为已提醒'}
              </button>
              {#if reminded && remindedAt}
                <span class="text-sm text-slate-500">
                  提醒时间：{formatDate(remindedAt)}
                </span>
              {/if}
            </div>
            <p class="text-xs text-slate-400">
              点击后将记录本次提醒操作，便于后续追踪
            </p>
          </div>

          <div class="space-y-3">
            <button
              type="button"
              on:click={openRescheduleModal}
              disabled={status === 'DELIVERED' || status === 'CANCELLED'}
              class="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📅 重新约定交付日期
            </button>
            <p class="text-xs text-slate-400">
              已重新约期 {deliveryDateHistory.length} 次，原日期将作为历史记录保留
            </p>
          </div>
        </div>

        {#if deliveryDateHistory.length > 0}
          <div class="mt-6 pt-5 border-t border-slate-100">
            <h4 class="text-sm font-semibold text-slate-700 mb-3">📋 交付日期变更历史</h4>
            <div class="space-y-2">
              {#each deliveryDateHistory as record (record.id)}
                <div class="bg-slate-50 rounded-lg p-3 text-sm flex items-start justify-between gap-3 flex-wrap">
                  <div class="flex items-center gap-4 flex-wrap">
                    <span class="text-slate-500">
                      原日期：<span class="text-slate-700 font-medium line-through">{formatDate(record.previousDate)}</span>
                    </span>
                    <span class="text-slate-500">
                      → 新日期：<span class="text-medical-blue-600 font-medium">{formatDate(record.newDate)}</span>
                    </span>
                    <span class="text-slate-500">
                      原因：<span class="text-slate-700">{record.reason}</span>
                    </span>
                  </div>
                  <span class="text-xs text-slate-400 whitespace-nowrap">
                    {formatDate(record.changedAt)} · {record.changedBy}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <StepForm
        editing={editingStep}
        modelId={modelId}
        expectedDeliveryDate={expectedDeliveryDate}
        on:add={handleAddStep}
        on:update={handleUpdateStep}
      >
        <div slot="list" class="space-y-2">
          {#if sortedSteps.length === 0}
            <div class="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
              还没有制作步骤，点击上方添加
            </div>
          {:else}
            {#each sortedSteps as step (step.id)}
              <div
                class="border border-slate-200 rounded-xl p-4 {step.completed
                  ? 'bg-green-50/50 border-green-200'
                  : 'bg-white hover:bg-slate-50'} transition-colors"
              >
                <div class="flex items-start gap-3">
                  <label class="mt-1 flex-shrink-0 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={step.completed}
                      on:change={() => handleToggleComplete(step.id)}
                      class="w-5 h-5 rounded border-2 border-slate-300 text-green-500 focus:ring-green-500 focus:ring-offset-0 cursor-pointer"
                    />
                  </label>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span
                        class="font-medium {step.completed
                          ? 'text-green-700 line-through'
                          : 'text-slate-800'}"
                      >
                        {step.name}
                      </span>
                      {#if step.completed && step.completedAt}
                        <span class="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                          {formatDate(step.completedAt)} 完成
                        </span>
                      {/if}
                    </div>
                    <div class="flex flex-wrap gap-3 text-xs text-slate-500 mt-1.5">
                      <span>👤 {step.responsiblePerson || '-'}</span>
                      <span>📅 计划: {formatDate(step.plannedDate)}</span>
                    </div>
                    {#if step.remark}
                      <p class="text-xs text-slate-600 mt-2 bg-slate-100/50 rounded-lg px-3 py-2">
                        📝 {step.remark}
                      </p>
                    {/if}
                  </div>
                  <div class="flex gap-1">
                    <button
                      type="button"
                      on:click={() => handleEditStep(step)}
                      class="p-1.5 text-slate-400 hover:text-medical-blue-600 hover:bg-medical-blue-50 rounded-lg transition-colors"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      on:click={() => handleDeleteStep(step.id)}
                      class="p-1.5 text-slate-400 hover:text-warning-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            {/each}
            <div class="flex items-center justify-between px-2 pt-2 text-sm">
              <span class="text-slate-500">
                完成进度：
                <span class="font-semibold text-slate-700">
                  {completedCount}/{localSteps.length}
                </span>
                <span class="text-slate-400 ml-1">
                  （{localSteps.length > 0
                    ? Math.round((completedCount / localSteps.length) * 100)
                    : 0}%）
                </span>
              </span>
              <div class="h-2 w-32 bg-slate-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-gradient-to-r from-medical-blue-500 to-medical-green-500 transition-all duration-500"
                  style="width: {localSteps.length > 0
                    ? Math.round((completedCount / localSteps.length) * 100)
                    : 0}%"
                ></div>
              </div>
            </div>
          {/if}
        </div>
      </StepForm>

      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>🔍</span> 质检验收
          </h3>
          {#if reworkCount > 0}
            <span class="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full border border-red-200">
              累计返工 {reworkCount} 次
            </span>
          {/if}
        </div>

        {#if activeRework}
          <div class="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-lg flex-shrink-0">
              🛠️
            </div>
            <div class="flex-1">
              <p class="font-semibold text-amber-800 mb-1">返工进行中</p>
              <div class="text-sm text-amber-700 space-y-1">
                <p>
                  <span class="font-medium">返工工序：</span>{activeRework.reworkStepName}
                </p>
                <p>
                  <span class="font-medium">返工负责人：</span>{activeRework.reworkResponsiblePerson}
                </p>
                <p>
                  <span class="font-medium">开始时间：</span>{formatDate(activeRework.startedAt)}
                </p>
              </div>
              {#if latestInspection?.problemDescription}
                <p class="text-sm text-slate-700 mt-2">
                  <span class="font-medium">问题描述：</span>{latestInspection.problemDescription}
                </p>
              {/if}
              {#if latestInspection?.reworkRequirements}
                <p class="text-sm text-slate-700 mt-1">
                  <span class="font-medium">返工要求：</span>{latestInspection.reworkRequirements}
                </p>
              {/if}
              <div class="mt-3">
                <button
                  type="button"
                  on:click={openCompleteReworkModal}
                  class="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
                >
                  ✅ 完成返工
                </button>
              </div>
            </div>
          </div>
          </div>
        {:else if qualityStatus === 'FAILED' && latestInspection}
          <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                ⚠️
              </div>
              <div class="flex-1">
                <p class="font-semibold text-red-800 mb-1">需返工处理</p>
                <p class="text-sm text-red-700 mb-2">
                  最新质检结果为「不通过」，请根据以下问题描述和返工要求发起返工流程，完成整改后重新提交质检。
                </p>
                {#if latestInspection.problemDescription}
                  <p class="text-sm text-slate-700 mt-2">
                    <span class="font-medium">问题描述：</span>{latestInspection.problemDescription}
                  </p>
                {/if}
                {#if latestInspection.reworkRequirements}
                  <p class="text-sm text-slate-700 mt-1">
                    <span class="font-medium">返工要求：</span>{latestInspection.reworkRequirements}
                  </p>
                {/if}
                <div class="mt-3">
                  <button
                    type="button"
                    on:click={openStartReworkModal}
                    class="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
                  >
                    🔄 发起返工
                  </button>
                </div>
              </div>
            </div>
          </div>
        {:else if qualityStatus === 'PENDING'}
          <div class="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                🔍
              </div>
              <div class="flex-1">
                <p class="font-semibold text-orange-800 mb-1">待质检</p>
                <p class="text-sm text-orange-700">
                  制作步骤已完成或进入待试戴阶段，请及时填写质检记录进行验收。
                </p>
              </div>
            </div>
          </div>
        {:else if qualityStatus === 'PASSED_PENDING_DELIVERY'}
          <div class="mb-4 p-4 bg-teal-50 border border-teal-200 rounded-xl">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                ✅
              </div>
              <div class="flex-1">
                <p class="font-semibold text-teal-800 mb-1">质检通过，待交付</p>
                <p class="text-sm text-teal-700">
                  最近一次质检已通过，可将模型状态变更为「已交付」。
                </p>
              </div>
            </div>
          </div>
        {/if}

        {#if !activeRework}
          <QualityInspectionForm
            modelId={modelId}
            defaultInspector={responsiblePerson}
            on:submit={handleAddQualityInspection}
          />
        {/if}

        {#if localReworkRecords.length > 0}
          <div class="mt-6 pt-5 border-t border-slate-100">
            <h4 class="text-sm font-semibold text-slate-700 mb-3">🔄 返工历史记录（共 {localReworkRecords.length} 次）</h4>
            <div class="space-y-3">
              {#each localReworkRecords as record (record.id)}
                <div class="border border-slate-200 rounded-xl p-4 {record.status === 'IN_PROGRESS' ? 'bg-amber-50/50 border-amber-200' : 'bg-green-50/50 border-green-200'}">
                  <div class="flex items-start justify-between gap-3 flex-wrap">
                    <div class="flex items-center gap-3 flex-wrap">
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border {REWORK_STATUS_COLOR[record.status]}">
                        {REWORK_STATUS_LABEL[record.status]}
                      </span>
                      <span class="text-sm text-slate-600">
                        返工工序：<span class="font-medium text-slate-800">{record.reworkStepName}</span>
                      </span>
                      <span class="text-sm text-slate-600">
                        负责人：<span class="font-medium text-slate-800">{record.reworkResponsiblePerson}</span>
                      </span>
                    </div>
                    <span class="text-xs text-slate-400">
                      开始于 {formatDate(record.startedAt)}
                    </span>
                  </div>
                  {#if record.status === 'COMPLETED'}
                    <div class="mt-3 pt-3 border-t border-slate-200 space-y-1">
                      <p class="text-sm text-slate-600">
                        <span class="font-medium">完成人：</span>{record.completedBy}
                      </p>
                      <p class="text-sm text-slate-600">
                        <span class="font-medium">完成时间：</span>{record.completedAt ? formatDate(record.completedAt) : '-'}
                      </p>
                      {#if record.completionRemarks}
                        <p class="text-sm text-slate-600">
                          <span class="font-medium">完成备注：</span>{record.completionRemarks}
                        </p>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if localInspections.length > 0}
          <div class="mt-6 pt-5 border-t border-slate-100">
            <h4 class="text-sm font-semibold text-slate-700 mb-3">📋 质检历史记录（共 {localInspections.length} 次）</h4>
            <div class="space-y-3">
              {#each localInspections as record (record.id)}
                <div class="border border-slate-200 rounded-xl p-4 {record.result === 'PASS' ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'}">
                  <div class="flex items-start justify-between gap-3 flex-wrap">
                    <div class="flex items-center gap-3 flex-wrap">
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border {record.result === 'PASS' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'}">
                        <span class="w-1.5 h-1.5 rounded-full {record.result === 'PASS' ? 'bg-green-500' : 'bg-red-500'}"></span>
                        {INSPECTION_RESULT_LABEL[record.result]}
                      </span>
                      <span class="text-sm text-slate-600">
                        质检人：<span class="font-medium text-slate-800">{record.inspector}</span>
                      </span>
                      <span class="text-sm text-slate-600">
                        质检日期：<span class="font-medium text-slate-800">{formatDate(record.inspectionDate)}</span>
                      </span>
                    </div>
                    <span class="text-xs text-slate-400">
                      提交于 {formatDate(record.createdAt)}
                    </span>
                  </div>
                  {#if record.problemDescription}
                    <p class="text-sm text-slate-700 mt-3">
                      <span class="font-medium">问题描述：</span>{record.problemDescription}
                    </p>
                  {/if}
                  {#if record.reworkRequirements}
                    <p class="text-sm text-slate-700 mt-2">
                      <span class="font-medium">返工要求：</span>{record.reworkRequirements}
                    </p>
                  {/if}
                  {#if record.handlingRemarks}
                    <p class="text-sm text-slate-700 mt-2">
                      <span class="font-medium">处理备注：</span>{record.handlingRemarks}
                    </p>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <div class="flex items-center justify-end gap-3">
        <a href="/models" class="btn-secondary">取消</a>
        <button type="submit" class="btn-primary" disabled={saving}>
          {saving ? '保存中...' : '保存修改'}
        </button>
      </div>
    </form>

    {#if showDeleteConfirm}
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        on:click={() => (showDeleteConfirm = false)}
      >
        <div
          class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
          on:click|stopPropagation
        >
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 bg-warning-red-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
              ⚠️
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-bold text-slate-800 mb-2">确认删除？</h3>
              <p class="text-sm text-slate-500 mb-4">
                删除模型 <span class="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{modelNo}</span> 将同时删除其关联的所有制作步骤，此操作不可撤销。
              </p>
              <div class="flex gap-3 justify-end">
                <button
                  on:click={() => (showDeleteConfirm = false)}
                  class="btn-secondary text-sm"
                  disabled={deleting}
                >
                  取消
                </button>
                <button
                  on:click={handleDelete}
                  class="btn-danger text-sm"
                  disabled={deleting}
                >
                  {deleting ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if showRescheduleModal}
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        on:click={() => (showRescheduleModal = false)}
      >
        <div
          class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
          on:click|stopPropagation
        >
          <div class="flex items-start gap-4 mb-4">
            <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
              📅
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-bold text-slate-800 mb-1">重新约定交付日期</h3>
              <p class="text-sm text-slate-500">
                当前预计交付日期：<span class="font-medium text-slate-700">{formatDate(expectedDeliveryDate)}</span>
              </p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="label-text">
                新的交付日期 <span class="text-warning-red-500">*</span>
              </label>
              <input
                type="date"
                bind:value={rescheduleNewDate}
                min={todayStr()}
                class="input-field {rescheduleErrors.newDate ? 'border-warning-red-400' : ''}"
              />
              {#if rescheduleErrors.newDate}
                <p class="text-xs text-warning-red-500 mt-1">{rescheduleErrors.newDate}</p>
              {/if}
            </div>

            <div>
              <label class="label-text">
                延期/变更原因 <span class="text-warning-red-500">*</span>
              </label>
              <textarea
                bind:value={rescheduleReason}
                placeholder="请详细说明变更交付日期的原因"
                rows="3"
                class="input-field {rescheduleErrors.reason ? 'border-warning-red-400' : ''} resize-none"
              ></textarea>
              {#if rescheduleErrors.reason}
                <p class="text-xs text-warning-red-500 mt-1">{rescheduleErrors.reason}</p>
              {/if}
            </div>
          </div>

          <div class="flex gap-3 justify-end mt-5">
            <button
              on:click={() => (showRescheduleModal = false)}
              class="btn-secondary text-sm"
            >
              取消
            </button>
            <button
              on:click={handleRescheduleSubmit}
              class="btn-primary text-sm"
            >
              确认变更
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if showStartReworkModal}
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        on:click={() => (showStartReworkModal = false)}
      >
        <div
          class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
          on:click|stopPropagation
        >
          <div class="flex items-start gap-4 mb-4">
            <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
              🔄
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-bold text-slate-800 mb-1">发起返工</h3>
              <p class="text-sm text-slate-500">
                选择需返工的工序，返工后所有步骤将重置为未完成状态，模型回到「制作中」
              </p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="label-text">
                返工工序 <span class="text-warning-red-500">*</span>
              </label>
              <select
                bind:value={reworkStepId}
                class="input-field {reworkErrors.reworkStepId ? 'border-warning-red-400' : ''}"
              >
                {#each localSteps as step}
                  <option value={step.id}>{step.name}</option>
                {/each}
              </select>
              {#if reworkErrors.reworkStepId}
                <p class="text-xs text-warning-red-500 mt-1">{reworkErrors.reworkStepId}</p>
              {/if}
            </div>

            <div>
              <label class="label-text">
                返工负责人 <span class="text-warning-red-500">*</span>
              </label>
              <input
                type="text"
                bind:value={reworkResponsiblePerson}
                placeholder="请填写返工负责人"
                class="input-field {reworkErrors.reworkResponsiblePerson ? 'border-warning-red-400' : ''}"
              />
              {#if reworkErrors.reworkResponsiblePerson}
                <p class="text-xs text-warning-red-500 mt-1">{reworkErrors.reworkResponsiblePerson}</p>
              {/if}
            </div>
          </div>

          <div class="flex gap-3 justify-end mt-5">
            <button
              on:click={() => (showStartReworkModal = false)}
              class="btn-secondary text-sm"
            >
              取消
            </button>
            <button
              on:click={handleStartReworkSubmit}
              class="btn-danger text-sm"
            >
              确认发起返工
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if showCompleteReworkModal}
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        on:click={() => (showCompleteReworkModal = false)}
      >
        <div
          class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
          on:click|stopPropagation
        >
          <div class="flex items-start gap-4 mb-4">
            <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
              ✅
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-bold text-slate-800 mb-1">完成返工</h3>
              <p class="text-sm text-slate-500">
                确认返工已完成，模型将回到待质检状态
              </p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="label-text">
                完成人 <span class="text-warning-red-500">*</span>
              </label>
              <input
                type="text"
                bind:value={completeReworkBy}
                placeholder="请填写完成人"
                class="input-field {completeReworkErrors.completedBy ? 'border-warning-red-400' : ''}"
              />
              {#if completeReworkErrors.completedBy}
                <p class="text-xs text-warning-red-500 mt-1">{completeReworkErrors.completedBy}</p>
              {/if}
            </div>

            <div>
              <label class="label-text">完成备注（可选）</label>
              <textarea
                bind:value={completeReworkRemarks}
                placeholder="填写返工完成情况"
                rows="3"
                class="input-field resize-none"
              ></textarea>
            </div>
          </div>

          <div class="flex gap-3 justify-end mt-5">
            <button
              on:click={() => (showCompleteReworkModal = false)}
              class="btn-secondary text-sm"
            >
              取消
            </button>
            <button
              on:click={handleCompleteReworkSubmit}
              class="btn-primary text-sm"
            >
              确认完成
            </button>
          </div>
        </div>
      </div>
    {/if}
  </main>
{:else}
  <main class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="text-center py-16 text-slate-400">加载中...</div>
  </main>
{/if}
