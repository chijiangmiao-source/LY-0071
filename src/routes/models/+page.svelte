<script lang="ts">
  import { browser } from '$app/environment';
  import AppHeader from '$components/AppHeader.svelte';
  import ModelCard from '$components/ModelCard.svelte';
  import SearchFilter from '$components/SearchFilter.svelte';
  import { models, steps } from '$lib/store';
  import type { FlowStatus, DentureType, Model, Step } from '$lib/types';
  import { derived, get } from 'svelte/store';

  let searchText = '';
  let statusFilter: FlowStatus | '' = '';
  let typeFilter: DentureType | '' = '';
  let personFilter = '';

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
    return true;
  });

  $: sortedModels = [...filteredModels].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
</script>

<AppHeader />

<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold text-slate-800 mb-1">模型列表</h2>
      <p class="text-sm text-slate-500">
        共 {sortedModels.length} 个模型
        {#if searchText || statusFilter || typeFilter || personFilter}
          （已筛选）
        {/if}
      </p>
    </div>
    <a href="/models/new" class="btn-primary">
      + 新增模型
    </a>
  </div>

  <SearchFilter
    bind:searchText
    bind:statusFilter
    bind:typeFilter
    bind:personFilter
    responsiblePersons={$responsiblePersons}
  />

  {#if sortedModels.length === 0}
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 text-center">
      <div class="text-6xl mb-4">🦷</div>
      <h3 class="text-lg font-semibold text-slate-700 mb-2">暂无模型数据</h3>
      <p class="text-slate-500 mb-6">
        {searchText || statusFilter || typeFilter || personFilter
          ? '没有找到符合条件的模型，请调整筛选条件'
          : '点击下方按钮添加第一个义齿模型'}
      </p>
      <a href="/models/new" class="btn-primary">+ 新增模型</a>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each sortedModels as model (model.id)}
        <ModelCard model={model} steps={getSteps(model.id)} />
      {/each}
    </div>
  {/if}
</main>
