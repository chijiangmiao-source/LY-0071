<script lang="ts">
  import type { QualityStatus } from '$lib/types';
  import { QUALITY_STATUS_LABEL, QUALITY_STATUS_COLOR, QUALITY_STATUS_DOT_COLOR } from '$lib/types';

  export let status: QualityStatus;
  export let size: 'sm' | 'md' = 'sm';

  $: label = QUALITY_STATUS_LABEL[status];
  $: color = QUALITY_STATUS_COLOR[status];
  $: dotColor = QUALITY_STATUS_DOT_COLOR[status];
  $: sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
</script>

{#if status !== 'NONE' && label}
  <span class="inline-flex items-center font-medium border rounded-full {color} {sizeClass}">
    <span class="w-1.5 h-1.5 rounded-full mr-1.5 {dotColor}"></span>
    {label}
  </span>
{/if}
