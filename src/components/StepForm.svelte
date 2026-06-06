<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Step } from '$lib/types';
  import { formatDate } from '$lib/formatters';
  import { validateStep } from '$lib/validators';

  const dispatch = createEventDispatcher();

  export let editing: Step | null = null;
  export let modelId: string = '';
  export let expectedDeliveryDate: string = '';

  let name: string = '';
  let responsiblePerson: string = '';
  let plannedDate: string = '';
  let completed: boolean = false;
  let remark: string = '';
  let errors: Record<string, string> = {};
  let showForm = false;

  $: if (editing) {
    name = editing.name;
    responsiblePerson = editing.responsiblePerson;
    plannedDate = editing.plannedDate;
    completed = editing.completed;
    remark = editing.remark || '';
    showForm = true;
  }

  function resetForm() {
    name = '';
    responsiblePerson = '';
    plannedDate = '';
    completed = false;
    remark = '';
    errors = {};
    editing = null;
    showForm = false;
  }

  function handleSubmit() {
    const data = { name, responsiblePerson, plannedDate, completed, remark };
    const result = validateStep(data, expectedDeliveryDate);
    if (!result.valid) {
      errors = result.errors;
      return;
    }
    if (editing) {
      dispatch('update', { id: editing.id, data });
    } else {
      dispatch('add', { ...data, modelId, completed: false });
    }
    resetForm();
  }

  function handleCancel() {
    resetForm();
  }

  function toggleForm() {
    if (showForm) {
      resetForm();
    } else {
      editing = null;
      completed = false;
      showForm = true;
    }
  }
</script>

<div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-bold text-slate-800">制作步骤</h3>
    <button type="button" on:click={toggleForm} class="btn-primary text-sm">
      {showForm ? '取消' : '+ 添加步骤'}
    </button>
  </div>

  {#if showForm}
    <div class="bg-slate-50 rounded-xl p-4 mb-4 border border-slate-200">
      <h4 class="text-sm font-semibold text-slate-700 mb-3">
        {editing ? '编辑步骤' : '新增步骤'}
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label class="label-text">步骤名称 <span class="text-warning-red-500">*</span></label>
          <input
            type="text"
            bind:value={name}
            placeholder="例如：蜡型制作"
            class="input-field {errors.name ? 'border-warning-red-400' : ''}"
          />
          {#if errors.name}
            <p class="text-xs text-warning-red-500 mt-1">{errors.name}</p>
          {/if}
        </div>
        <div>
          <label class="label-text">负责人 <span class="text-warning-red-500">*</span></label>
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
          <label class="label-text">计划完成日期 <span class="text-warning-red-500">*</span></label>
          <input
            type="date"
            bind:value={plannedDate}
            max={expectedDeliveryDate || undefined}
            class="input-field {errors.plannedDate ? 'border-warning-red-400' : ''}"
          />
          {#if errors.plannedDate}
            <p class="text-xs text-warning-red-500 mt-1">{errors.plannedDate}</p>
          {/if}
          {#if expectedDeliveryDate}
            <p class="text-xs text-slate-400 mt-1">
              不能晚于预计交付日期：{formatDate(expectedDeliveryDate)}
            </p>
          {/if}
        </div>
        {#if editing}
          <div>
            <label class="label-text">步骤状态</label>
            <div class="flex items-center gap-2 h-[42px] px-3 border border-slate-200 rounded-lg bg-white">
              <input
                type="checkbox"
                bind:checked={completed}
                class="w-4 h-4 rounded border-slate-300 text-green-500 focus:ring-green-500"
              />
              <span class="text-sm {completed ? 'text-green-600 font-medium' : 'text-slate-600'}">
                {completed ? '✓ 已完成' : '未完成'}
              </span>
            </div>
          </div>
        {/if}
        <div class="md:col-span-2">
          <label class="label-text">备注</label>
          <textarea
            bind:value={remark}
            placeholder="可选，记录注意事项等..."
            rows={2}
            class="input-field resize-none"
          ></textarea>
        </div>
      </div>
      <div class="flex gap-2 justify-end">
        <button type="button" on:click={handleCancel} class="btn-secondary text-sm">取消</button>
        <button type="button" on:click={handleSubmit} class="btn-primary text-sm">
          {editing ? '保存修改' : '添加步骤'}
        </button>
      </div>
    </div>
  {/if}

  <slot name="list" />
</div>
