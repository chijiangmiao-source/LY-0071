<script lang="ts">
  import { goto } from '$app/navigation';
  import { createEventDispatcher } from 'svelte';
  import StatusBadge from './StatusBadge.svelte';
  import QualityStatusBadge from './QualityStatusBadge.svelte';
  import type { Model, Step, QualityStatus } from '$lib/types';
  import { DENTURE_TYPE_LABEL } from '$lib/types';
  import { formatDate, daysRemaining } from '$lib/formatters';
  import { getDeliveryStatusInfo, shouldShowAlert } from '$lib/domain/deliveryRules';
  import { getQualityStatus } from '$lib/store';

  export let model: Model;
  export let steps: Step[] = [];
  export let selectable: boolean = false;
  export let selected: boolean = false;

  const dispatch = createEventDispatcher<{
    toggleSelect: { modelId: string; selected: boolean };
  }>();

  let qualityStatus: QualityStatus = 'NONE';
  let showQualityAlert = false;

  $: completedSteps = steps.filter((s) => s.completed).length;
  $: totalSteps = steps.length;
  $: progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  $: deliveryInfo = getDeliveryStatusInfo(model);
  $: overdue = deliveryInfo.isOverdue;
  $: upcoming = deliveryInfo.isUpcoming;
  $: remaining = deliveryInfo.remainingDays;
  $: showAlert = shouldShowAlert(model);
  $: {
    qualityStatus = getQualityStatus(model);
    showQualityAlert = qualityStatus === 'PENDING' || qualityStatus === 'FAILED';
  }

  function handleEdit() {
    if (!selectable) {
      goto(`/models/${model.id}`);
    }
  }

  function handleCardClick() {
    if (selectable) {
      dispatch('toggleSelect', { modelId: model.id, selected: !selected });
    }
  }

  function handleCheckboxClick(e: Event) {
    e.stopPropagation();
    dispatch('toggleSelect', { modelId: model.id, selected: !selected });
  }

  function handleEditClick(e: Event) {
    e.stopPropagation();
    goto(`/models/${model.id}`);
  }
</script>

<div
  class="bg-white rounded-2xl shadow-sm border card-hover overflow-hidden {
    selectable && selected
      ? 'border-medical-blue-500 ring-2 ring-medical-blue-200'
      : qualityStatus === 'FAILED'
      ? 'border-red-400 ring-2 ring-red-100'
      : qualityStatus === 'PENDING'
      ? 'border-orange-400 ring-2 ring-orange-100'
      : overdue
      ? 'border-warning-red-300 ring-2 ring-warning-red-100'
      : upcoming
      ? 'border-amber-300 ring-2 ring-amber-100'
      : 'border-slate-100'
  } {selectable ? 'cursor-pointer' : ''}"
  on:click={handleCardClick}
>
  {#if qualityStatus === 'FAILED'}
    <div class="bg-red-500 text-white text-xs font-medium px-4 py-1.5 flex items-center gap-1.5">
      <span>❌</span>
      <span>质检未通过，需返工处理</span>
    </div>
  {:else if qualityStatus === 'PENDING'}
    <div class="bg-orange-500 text-white text-xs font-medium px-4 py-1.5 flex items-center gap-1.5">
      <span>🔍</span>
      <span>待质检，请及时安排验收</span>
    </div>
  {:else if showAlert}
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
      <div class="flex items-start gap-2">
        {#if selectable}
          <label class="mt-0.5 flex-shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={selected}
              on:click={handleCheckboxClick}
              on:change={(e) => {}}
              class="w-5 h-5 rounded border-2 border-slate-300 text-medical-blue-600 focus:ring-medical-blue-500 focus:ring-offset-0 cursor-pointer"
            />
          </label>
        {/if}
        <div>
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {model.modelNo}
            </span>
            <StatusBadge status={model.status} />
            <QualityStatusBadge status={qualityStatus} />
          </div>
          <h3 class="text-lg font-bold text-slate-800">{model.patientName}</h3>
        </div>
      </div>
      <button
        on:click={handleEditClick}
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
