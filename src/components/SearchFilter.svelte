<script lang="ts">
  import type { FlowStatus, DentureType } from '$lib/types';
  import { FLOW_STATUS_LABEL, DENTURE_TYPE_LABEL } from '$lib/types';

  export let searchText: string = '';
  export let statusFilter: FlowStatus | '' = '';
  export let typeFilter: DentureType | '' = '';
  export let personFilter: string = '';
  export let responsiblePersons: string[] = [];

  let showAdvanced = false;
</script>

<div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
  <div class="flex flex-col md:flex-row gap-3">
    <div class="flex-1 relative">
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
      <input
        type="text"
        bind:value={searchText}
        placeholder="搜索模型编号或患者姓名..."
        class="input-field pl-10"
      />
    </div>
    <div class="flex gap-2">
      <button
        on:click={() => (showAdvanced = !showAdvanced)}
        class="btn-secondary whitespace-nowrap"
      >
        {showAdvanced ? '收起筛选' : '高级筛选'}
      </button>
      <button
        on:click={() => {
          searchText = '';
          statusFilter = '';
          typeFilter = '';
          personFilter = '';
        }}
        class="btn-secondary whitespace-nowrap"
      >
        重置
      </button>
    </div>
  </div>

  {#if showAdvanced}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
      <div>
        <label class="label-text">流转状态</label>
        <select bind:value={statusFilter} class="input-field">
          <option value="">全部状态</option>
          {#each Object.entries(FLOW_STATUS_LABEL) as [value, label]}
            <option value={value}>{label}</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="label-text">义齿类型</label>
        <select bind:value={typeFilter} class="input-field">
          <option value="">全部类型</option>
          {#each Object.entries(DENTURE_TYPE_LABEL) as [value, label]}
            <option value={value}>{label}</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="label-text">负责人</label>
        <select bind:value={personFilter} class="input-field">
          <option value="">全部负责人</option>
          {#each responsiblePersons as person}
            <option value={person}>{person}</option>
          {/each}
        </select>
      </div>
    </div>
  {/if}
</div>
