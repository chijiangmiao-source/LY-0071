<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import AppHeader from '$components/AppHeader.svelte';
  import StatusBadge from '$components/StatusBadge.svelte';
  import StepForm from '$components/StepForm.svelte';
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
    getStepsByModelId
  } from '$lib/store';
  import {
    validateModel,
    canTransitionTo,
    canMarkDelivered
  } from '$lib/validators';
  import type { FlowStatus, DentureType, Model, Step } from '$lib/types';
  import { FLOW_STATUS_LABEL, DENTURE_TYPE_LABEL, DEFAULT_STEP_NAMES } from '$lib/types';
  import { todayStr, formatDate, isOverdue, daysRemaining } from '$lib/formatters';
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
  let errors: Record<string, string> = {};
  let saving = false;
  let editingStep: Step | null = null;
  let loaded = false;
  let showDeliverWarning = false;
  let deliverWarningMessage = '';
  let showDeleteConfirm = false;
  let deleting = false;

  $: modelId = $page.params.id;
  $: localSteps = get(steps).filter((s) => s.modelId === modelId);

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

    const check = canTransitionTo(status, newStatus, localSteps);
    if (!check.valid) {
      showDeliverWarning = true;
      deliverWarningMessage = check.message || '';
      target.value = status;
      return;
    }
    status = newStatus;
    showDeliverWarning = false;
  }

  async function handleSubmit() {
    const data = {
      modelNo: modelNo.trim(),
      patientName: patientName.trim(),
      dentureType,
      impressionDate,
      expectedDeliveryDate,
      responsiblePerson: responsiblePerson.trim(),
      status
    };
    const result = validateModel(data, get(models), modelId);
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

  $: completedCount = localSteps.filter((s) => s.completed).length;
  $: overdue = loaded && isOverdue(expectedDeliveryDate, status);
  $: remaining = daysRemaining(expectedDeliveryDate);
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
          {#if overdue}
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-warning-red-500 text-white text-sm font-medium rounded-full">
              ⚠️
              {#if remaining < 0}
                已延期 {Math.abs(remaining)} 天
              {:else if remaining === 0}
                今日到期
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
        </div>
      </div>

      <StepForm
        editing={editingStep}
        modelId={modelId}
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
                  <button
                    type="button"
                    on:click={() => handleToggleComplete(step.id)}
                    class="mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all {step.completed
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-slate-300 hover:border-medical-blue-500'}"
                  >
                    {#if step.completed}
                      <span class="text-xs">✓</span>
                    {/if}
                  </button>
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
  </main>
{:else}
  <main class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="text-center py-16 text-slate-400">加载中...</div>
  </main>
{/if}
