<script lang="ts">
  import { page } from '$app/stores';
  import type { FlowStatus } from '$lib/types';
  import { FLOW_STATUS_LABEL, FLOW_STATUS_COLOR } from '$lib/types';

  export let status: FlowStatus;
  export let size: 'sm' | 'md' = 'sm';

  $: label = FLOW_STATUS_LABEL[status];
  $: color = FLOW_STATUS_COLOR[status];
  $: sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
</script>

<span class="inline-flex items-center font-medium border rounded-full {color} {sizeClass}">
  <span class="w-1.5 h-1.5 rounded-full mr-1.5 {getDotColor(status)}"></span>
  {label}
</span>

<script lang="ts" context="module">
  function getDotColor(status: FlowStatus): string {
    switch (status) {
      case 'PENDING': return 'bg-slate-500';
      case 'IN_PROGRESS': return 'bg-blue-500';
      case 'TRIAL': return 'bg-amber-500';
      case 'DELIVERED': return 'bg-green-500';
      case 'CANCELLED': return 'bg-gray-400';
    }
  }
</script>
