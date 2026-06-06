<script lang="ts">
  import { browser } from '$app/environment';
  import AppHeader from '$components/AppHeader.svelte';
  import ModelCard from '$components/ModelCard.svelte';
  import SearchFilter from '$components/SearchFilter.svelte';
  import BatchActionToolbar from '$components/BatchActionToolbar.svelte';
  import {
    models,
    steps,
    getQualityStatus,
    executeBatchOperation,
    exportModelsSummary,
    downloadSummary
  } from '$lib/store';
  import type { FlowStatus, DentureType, Model, Step, QualityStatus, BatchActionType } from '$lib/types';
  import { derived, get } from 'svelte/store';

  let searchText = '';
  let statusFilter: FlowStatus | '' = '';
  let typeFilter: DentureType | '' = '';
  let personFilter = '';
  let qualityStatusFilter: QualityStatus | '' = '';
  let selectedModelIds = new Set<string>();
  let batchToolbar: BatchActionToolbar | null = null;

  const responsiblePersons = derived(models, ($models) => {
    const set = new Set<string>();
    for (const m of $models) {
      if (m.responsiblePerson) set.add(m.responsiblePerson);
    }
    return Array.from(set);
  });

  function getSteps(modelId: string): Step[] {
    return get(steps).filter((s) => s.modelId === modelId);
  }

  function toggleSelection(e: CustomEvent<{ modelId: string; selected: boolean }>) {
    const { modelId, selected } = e.detail;
    if (selected) {
      selectedModelIds.add(modelId);
    } else {
      selectedModelIds.delete(modelId);
    }
    selectedModelIds = new Set(selectedModelIds);
  }

  function clearSelection() {
    selectedModelIds = new Set<string>();
  }

  function selectAll() {
    selectedModelIds = new Set(sortedModels.map((m) => m.id));
  }

  function deselectAll() {
    selectedModelIds = new Set<string>();
  }

  function handleBatchExecute(e: CustomEvent<{ actionType: BatchActionType; payload: Record<string, any> }>) {
    const { actionType, payload } = e.detail;
    const ids = Array.from(selectedModelIds);

    if (actionType === 'EXPORT_SUMMARY') {
      const text = exportModelsSummary(ids);
      downloadSummary(text);
      executeBatchOperation(ids, actionType, payload, '系统');
      clearSelection();
      return;
    }

    const result = executeBatchOperation(ids, actionType, payload, '系统');
    batchToolbar?.showExecuteResult({
      succeeded: result.succeeded,
      failed: result.failed,
      failureReasons: result.failureReasons
    });

    if (result.succeeded > 0) {
      const successSet = new Set(result.succeededIds);
      selectedModelIds = new Set(Array.from(selectedModelIds).filter((id) => !successSet.has(id)));
    }
  }

  $: impressionDatesMap = (() => {
    const map: Record<string, string> = {};
    for (const id of selectedModelIds) {
      const m = get(models).find((x) => x.id === id);
      if (m) map[id] = m.impressionDate;
    }
    return map;
  })();

  $: filteredModels = $models.filter((m) => {
    if (searchText) {
      const q = searchText.toLowerCase();
      if (
        !m.modelNo.toLowerCase().includes(q) &&
        !m.patientName.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    if (statusFilter && m.status !== statusFilter) return false;
    if (typeFilter && m.dentureType !== typeFilter) return false;
    if (personFilter && m.responsiblePerson !== personFilter) return false;
    if (qualityStatusFilter) {
      const qs = getQualityStatus(m);
      if (qs !== qualityStatusFilter) return false;
    }
    return true;
  });

  $: sortedModels = [...filteredModels].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  $: allSelected = sortedModels.length > 0 && sortedModels.every((m) => selectedModelIds.has(m.id));
  $: someSelected = sortedModels.some((m) => selectedModelIds.has(m.id));
  $: selectedCount = selectedModelIds.size;
</script>

<AppHeader />

<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
  <div class="mb-6 flex items-center justify-between flex-wrap gap-3">
    <div>
      <h2 class="text-2xl font-bold text-slate-800 mb-1">模型列表</h2>
      <p class="text-sm text-slate-500">
        共 {sortedModels.length} 个模型
        {#if selectedCount > 0}
          · 已选 {selectedCount} 个
        {/if}
        {#if searchText || statusFilter || typeFilter || personFilter || qualityStatusFilter}
          （已筛选）
        {/if}
      </p>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      {#if sortedModels.length > 0}
        <button
          type="button"
          on:click={allSelected ? deselectAll : selectAll}
          class="btn-secondary whitespace-nowrap"
        >
          {allSelected ? '取消全选' : '全选当前'}
        </button>
      {/if}
      <a href="/models/new" class="btn-primary">
        + 新增模型
      </a>
    </div>
  </div>

  <BatchActionToolbar
    bind:this={batchToolbar}
    selectedCount={selectedCount}
    impressionDates={impressionDatesMap}
    on:execute={handleBatchExecute}
    on:clearSelection={clearSelection}
  />

  <SearchFilter
    bind:searchText
    bind:statusFilter
    bind:typeFilter
    bind:personFilter
    bind:qualityStatusFilter
    responsiblePersons={$responsiblePersons}
  />

  {#if sortedModels.length === 0}
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 text-center">
      <div class="text-6xl mb-4">🦷</div>
      <h3 class="text-lg font-semibold text-slate-700 mb-2">暂无模型数据</h3>
      <p class="text-slate-500 mb-6">
        {searchText || statusFilter || typeFilter || personFilter || qualityStatusFilter
          ? '没有找到符合条件的模型，请调整筛选条件'
          : '点击下方按钮添加第一个义齿模型'}
      </p>
      <a href="/models/new" class="btn-primary">+ 新增模型</a>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each sortedModels as model (model.id)}
        <ModelCard
          model={model}
          steps={getSteps(model.id)}
          selectable={true}
          selected={selectedModelIds.has(model.id)}
          on:toggleSelect={toggleSelection}
        />
      {/each}
    </div>
  {/if}
</main>
