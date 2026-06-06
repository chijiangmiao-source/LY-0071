<script lang="ts">
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import AppHeader from '$components/AppHeader.svelte';
  import StatusBadge from '$components/StatusBadge.svelte';
  import StepForm from '$components/StepForm.svelte';
  import {
    models,
    addModel,
    addStep
  } from '$lib/store';
  import {
    validateModel,
    canTransitionTo,
    canMarkDelivered
  } from '$lib/validators';
  import type { FlowStatus, DentureType, Model, Step } from '$lib/types';
  import { FLOW_STATUS_LABEL, DENTURE_TYPE_LABEL, DEFAULT_STEP_NAMES } from '$lib/types';
  import { todayStr, formatDate } from '$lib/formatters';

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
  let localSteps: Step[] = [];
  let showDeliverWarning = false;
  let deliverWarningMessage = '';

  const dentureTypeOptions = Object.entries(DENTURE_TYPE_LABEL) as [DentureType, string][];

  function addDefaultSteps() {
    const today = new Date();
    const baseDate = impressionDate ? new Date(impressionDate) : today;
    localSteps = DEFAULT_STEP_NAMES.map((name, idx) => {
      const planned = new Date(baseDate);
      planned.setDate(planned.getDate() + (idx + 1) * 2);
      return {
        id: 'temp_' + Math.random().toString(36).slice(2, 10),
        modelId: '',
        name,
        responsiblePerson: responsiblePerson || '',
        plannedDate: planned.toISOString().split('T')[0],
        completed: false
      };
    });
  }

  function handleAddStep(e: CustomEvent) {
    const data = e.detail;
    const newStep: Step = {
      ...data,
      id: 'temp_' + Math.random().toString(36).slice(2, 10),
      completed: false
    };
    localSteps = [...localSteps, newStep];
  }

  function handleUpdateStep(e: CustomEvent) {
    const { id, data } = e.detail;
    localSteps = localSteps.map((s) => (s.id === id ? { ...s, ...data } : s));
    editingStep = null;
  }

  function handleDeleteStep(id: string) {
    localSteps = localSteps.filter((s) => s.id !== id);
  }

  function handleEditStep(step: Step) {
    editingStep = step;
  }

  function handleToggleComplete(id: string) {
    localSteps = localSteps.map((s) => {
      if (s.id !== id) return s;
      const completed = !s.completed;
      return {
        ...s,
        completed,
        completedAt: completed ? new Date().toISOString() : undefined
      };
    });
  }

  function onStatusChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const newStatus = target.value as FlowStatus;

    if (newStatus === 'DELIVERED') {
      const check = canMarkDelivered(localSteps);
      if (!check.valid) {
        showDeliverWarning = true;
        deliverWarningMessage = check.message || '';
        target.value = status;
        return;
      }
    }

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
    const result = validateModel(data, get(models), localSteps);
    if (!result.valid) {
      errors = result.errors;
      return;
    }
    errors = {};
    saving = true;

    try {
      const newModel = addModel(data);
      for (const step of localSteps) {
        const { id: _tempId, modelId: _m, ...stepData } = step;
        addStep({
          ...stepData,
          modelId: newModel.id
        });
      }
      goto('/models');
    } finally {
      saving = false;
    }
  }

  $: completedCount = localSteps.filter((s) => s.completed).length;
</script>

<AppHeader />

<main class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <a href="/models" class="text-sm text-slate-500 hover:text-medical-blue-600 transition-colors">
        ← 返回模型列表
      </a>
      <h2 class="text-2xl font-bold text-slate-800 mt-1">新增义齿模型</h2>
      <p class="text-sm text-slate-500">填写模型基本信息和制作步骤</p>
    </div>
    <StatusBadge status={status} size="md" />
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
            placeholder="例如：M202606001"
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
            placeholder="请输入患者姓名"
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
          {#if errors.dentureType}
            <p class="text-xs text-warning-red-500 mt-1">{errors.dentureType}</p>
          {/if}
        </div>

        <div>
          <label class="label-text">
            负责人 <span class="text-warning-red-500">*</span>
          </label>
          <input
            type="text"
            bind:value={responsiblePerson}
            placeholder="例如：张技师"
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
            class="input-field {errors.status ? 'border-warning-red-400' : ''}"
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
          {#if errors.status}
            <p class="text-xs text-warning-red-500 mt-1">{errors.status}</p>
          {/if}
        </div>
      </div>
    </div>

    <StepForm
      editing={editingStep}
      on:add={handleAddStep}
      on:update={handleUpdateStep}
    >
      <div slot="list" class="space-y-2">
        {#if localSteps.length === 0}
          <div class="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
            <p class="mb-3">还没有制作步骤</p>
            <button
              type="button"
              on:click={addDefaultSteps}
              class="text-medical-blue-600 hover:underline font-medium text-sm"
            >
              一键添加默认步骤模板 →
            </button>
          </div>
        {:else}
          {#each localSteps as step (step.id)}
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
                  aria-label={step.completed ? '标记未完成' : '标记完成'}
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
                    aria-label="编辑"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    on:click={() => handleDeleteStep(step.id)}
                    class="p-1.5 text-slate-400 hover:text-warning-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    aria-label="删除"
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
          </div>
        {/if}
      </div>
    </StepForm>

    <div class="flex items-center justify-end gap-3">
      <a href="/models" class="btn-secondary">取消</a>
      <button type="submit" class="btn-primary" disabled={saving}>
        {saving ? '保存中...' : '保存模型'}
      </button>
    </div>
  </form>
</main>
