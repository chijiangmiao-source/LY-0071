<script lang="ts">
  import { goto } from '$app/navigation';
  import StatusBadge from './StatusBadge.svelte';
  import type { Model, Step } from '$lib/types';
  import { DENTURE_TYPE_LABEL, DEFAULT_REMINDER_DAYS } from '$lib/types';
  import { formatDate, isOverdue, daysRemaining, getDeliveryStatus } from '$lib/formatters';

  export let model: Model;
  export let steps: Step[] = [];

  $: completedSteps = steps.filter((s) => s.completed).length;
  $: totalSteps = steps.length;
  $: progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  $: deliveryStatus = getDeliveryStatus(
    model.expectedDeliveryDate,
    model.status,
    model.reminderDays ?? DEFAULT_REMINDER_DAYS
  );
  $: overdue = deliveryStatus === 'OVERDUE';
  $: upcoming = deliveryStatus === 'UPCOMING';
  $: remaining = daysRemaining(model.expectedDeliveryDate);
  $: showAlert = overdue || upcoming;

  function handleEdit() {
    goto(`/models/${model.id}`);
  }
</script>

<div
  class="bg-white rounded-2xl shadow-sm border card-hover overflow-hidden {
    overdue
      ? 'border-warning-red-300 ring-2 ring-warning-red-100'
      : upcoming
      ? 'border-amber-300 ring-2 ring-amber-100'
      : 'border-slate-100'
  }"
>
  {#if showAlert}
    <div class="{overdue ? 'bg-warning-red-500' : 'bg-amber-500'} text-white text-xs font-medium px-4 py-1.5 flex items-center gap-1.5">
      <span>{overdue ? '⚠️' : '⏰'}</span>
      <span>
        {#if overdue}
          已延期 {Math.abs(remaining)} 天
        {:else if remaining === 0}
          今日到期
        {:else}
          剩余 {remaining} 天到期
        {/if}
      </span>
      {#if model.reminded}
        <span class="ml-auto bg-white/20 px-2 py-0.5 rounded-full text-[10px]">已提醒</span>
      {/if}
    </div>
  {/if}

  <div class="p-5">
    <div class="flex items-start justify-between mb-3">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            {model.modelNo}
          </span>
          <StatusBadge status={model.status} />
        </div>
        <h3 class="text-lg font-bold text-slate-800">{model.patientName}</h3>
      </div>
      <button
        on:click={handleEdit}
        class="text-slate-400 hover:text-medical-blue-600 transition-colors p-1.5 hover:bg-slate-100 rounded-lg"
        aria-label="编辑"
      >
        ✏️
      </button>
    </div>

    <div class="space-y-2 mb-4">
      <div class="flex items-center gap-2 text-sm">
        <span class="text-slate-400">🦷</span>
        <span class="text-slate-600">{DENTURE_TYPE_LABEL[model.dentureType]}</span>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <span class="text-slate-400">👤</span>
        <span class="text-slate-600">{model.responsiblePerson}</span>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <span class="text-slate-400">📅</span>
        <span class="text-slate-600">
          取模: {formatDate(model.impressionDate)}
        </span>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <span class="text-slate-400">🎯</span>
        <span class={overdue ? 'text-warning-red-600 font-medium' : upcoming ? 'text-amber-600 font-medium' : 'text-slate-600'}>
          预计: {formatDate(model.expectedDeliveryDate)}
        </span>
      </div>
    </div>

    {#if totalSteps > 0}
      <div>
        <div class="flex items-center justify-between text-xs text-slate-500 mb-1.5">
          <span>制作进度</span>
          <span class="font-medium">{completedSteps}/{totalSteps} 步骤 · {progress}%</span>
        </div>
        <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            class="h-full bg-gradient-to-r from-medical-blue-500 to-medical-green-500 rounded-full transition-all duration-500"
            style="width: {progress}%"
          ></div>
        </div>
      </div>
    {/if}
  </div>
</div>
