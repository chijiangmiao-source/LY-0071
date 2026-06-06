<script lang="ts">
  export let title: string;
  export let value: number | string;
  export let icon: string = '📊';
  export let gradient: string = 'from-blue-500 to-blue-600';
  export let subtitle: string = '';
</script>

<div class="relative overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-100 p-5 card-hover">
  <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br {gradient} opacity-10 -mt-8 -mr-8 rounded-full blur-2xl"></div>
  <div class="relative">
    <div class="flex items-start justify-between mb-3">
      <span class="text-sm font-medium text-slate-500">{title}</span>
      <div class="w-10 h-10 bg-gradient-to-br {gradient} rounded-xl flex items-center justify-center text-lg shadow-md">
        {icon}
      </div>
    </div>
    <div class="text-3xl font-bold text-slate-800 mb-1">{value}</div>
    {#if subtitle}
      <p class="text-xs text-slate-400">{subtitle}</p>
    {/if}
  </div>
</div>
