<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { InspectionResult } from '$lib/types';
  import { INSPECTION_RESULT_LABEL } from '$lib/types';
  import { todayStr } from '$lib/formatters';
  import { validateQualityInspection } from '$lib/validators';

  export let modelId: string;
  export let defaultInspector: string = '';

  const dispatch = createEventDispatcher();

  let inspector = defaultInspector;
  let inspectionDate = todayStr();
  let result: InspectionResult | '' = '';
  let problemDescription = '';
  let reworkRequirements = '';
  let handlingRemarks = '';
  let errors: Record<string, string> = {};
  let saving = false;

  $: isFail = result === 'FAIL';

  function handleSubmit() {
    const data = {
      modelId,
      inspector: inspector.trim(),
      inspectionDate,
      result: result as InspectionResult,
      problemDescription: problemDescription.trim() || undefined,
      reworkRequirements: reworkRequirements.trim() || undefined,
      handlingRemarks: handlingRemarks.trim() || undefined
    };
    const validation = validateQualityInspection(data);
    if (!validation.valid) {
      errors = validation.errors;
      return;
    }
    errors = {};
    saving = true;
    try {
      dispatch('submit', data);
      inspector = defaultInspector;
      inspectionDate = todayStr();
      result = '';
      problemDescription = '';
      reworkRequirements = '';
      handlingRemarks = '';
    } finally {
      saving = false;
    }
  }

  function handleReset() {
    inspector = defaultInspector;
    inspectionDate = todayStr();
    result = '';
    problemDescription = '';
    reworkRequirements = '';
    handlingRemarks = '';
    errors = {};
  }
</script>

<div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
  <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
    <span>🔍</span> 新增质检记录
  </h3>
  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label class="label-text">
          质检人 <span class="text-warning-red-500">*</span>
        </label>
        <input
          type="text"
          bind:value={inspector}
          placeholder="请填写质检人姓名"
          class="input-field {errors.inspector ? 'border-warning-red-400' : ''}"
        />
        {#if errors.inspector}
          <p class="text-xs text-warning-red-500 mt-1">{errors.inspector}</p>
        {/if}
      </div>

      <div>
        <label class="label-text">
          质检日期 <span class="text-warning-red-500">*</span>
        </label>
        <input
          type="date"
          bind:value={inspectionDate}
          max={todayStr()}
          class="input-field {errors.inspectionDate ? 'border-warning-red-400' : ''}"
        />
        {#if errors.inspectionDate}
          <p class="text-xs text-warning-red-500 mt-1">{errors.inspectionDate}</p>
        {/if}
      </div>

      <div>
        <label class="label-text">
          质检结果 <span class="text-warning-red-500">*</span>
        </label>
        <select
          bind:value={result}
          class="input-field {errors.result ? 'border-warning-red-400' : ''}"
        >
          <option value="">请选择</option>
          {#each Object.entries(INSPECTION_RESULT_LABEL) as [value, label]}
            <option value={value}>{label}</option>
          {/each}
        </select>
        {#if errors.result}
          <p class="text-xs text-warning-red-500 mt-1">{errors.result}</p>
        {/if}
      </div>
    </div>

    {#if isFail}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="label-text">
            问题描述 <span class="text-warning-red-500">*</span>
          </label>
          <textarea
            bind:value={problemDescription}
            placeholder="请详细描述发现的质量问题"
            rows="3"
            class="input-field {errors.problemDescription ? 'border-warning-red-400' : ''} resize-none"
          ></textarea>
          {#if errors.problemDescription}
            <p class="text-xs text-warning-red-500 mt-1">{errors.problemDescription}</p>
          {/if}
        </div>

        <div>
          <label class="label-text">
            返工要求 <span class="text-warning-red-500">*</span>
          </label>
          <textarea
            bind:value={reworkRequirements}
            placeholder="请说明具体的返工要求和整改方向"
            rows="3"
            class="input-field {errors.reworkRequirements ? 'border-warning-red-400' : ''} resize-none"
          ></textarea>
          {#if errors.reworkRequirements}
            <p class="text-xs text-warning-red-500 mt-1">{errors.reworkRequirements}</p>
          {/if}
        </div>
      </div>
    {/if}

    <div>
      <label class="label-text">处理备注（可选）</label>
      <textarea
        bind:value={handlingRemarks}
        placeholder="如有其他需要说明的事项请在此填写"
        rows="2"
        class="input-field resize-none"
      ></textarea>
    </div>

    {#if isFail}
      <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
        <span>⚠️</span>
        <div>
          <p class="font-medium">质检不通过将触发返工流程</p>
          <p class="text-xs mt-1 text-red-600">模型状态将保持为「质检未通过」，需完成返工并重新质检通过后才能交付</p>
        </div>
      </div>
    {/if}

    <div class="flex items-center justify-end gap-3">
      <button type="button" on:click={handleReset} class="btn-secondary">
        重置
      </button>
      <button type="submit" class="btn-primary" disabled={saving}>
        {saving ? '保存中...' : '提交质检记录'}
      </button>
    </div>
  </form>
</div>
