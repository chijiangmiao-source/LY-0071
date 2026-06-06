<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { get } from 'svelte/store';
  import AppHeader from '$components/AppHeader.svelte';
  import StatCard from '$components/StatCard.svelte';
  import StatusBadge from '$components/StatusBadge.svelte';
  import { models, modelsByStatus, overdueModels } from '$lib/store';
  import type { Model } from '$lib/types';
  import { DENTURE_TYPE_LABEL } from '$lib/types';
  import { formatDate, daysRemaining, getLastNDates } from '$lib/formatters';
  import { goto } from '$app/navigation';

  let chart1: any;
  let chart2: any;
  let ApexLoaded = false;

  onMount(async () => {
    if (!browser) return;
    const ApexCharts = (await import('apexcharts')).default;
    ApexLoaded = true;
    renderCharts(ApexCharts);
  });

  function getTotalCount() {
    return get(models).length;
  }

  function renderCharts(ApexCharts: any) {
    const pieOptions = {
      series: [],
      labels: ['待制作', '制作中', '待试戴', '已交付', '已取消'],
      chart: { type: 'donut', width: '100%', height: 280 },
      colors: ['#64748b', '#3b82f6', '#f59e0b', '#10b981', '#94a3b8'],
      legend: { position: 'bottom' },
      plotOptions: {
        pie: {
          donut: {
            size: '60%',
            labels: {
              show: true,
              total: { show: true, label: '模型总数', formatter: () => String(getTotalCount()) }
            }
          }
        }
      },
      dataLabels: { enabled: false },
      stroke: { width: 0 }
    };
    chart1 = new ApexCharts(document.getElementById('statusChart'), pieOptions);
    chart1.render();

    const lineOptions = {
      series: [
        { name: '新增模型', data: [] },
        { name: '交付模型', data: [] }
      ],
      chart: { type: 'area', height: 280, width: '100%', toolbar: { show: false } },
      colors: ['#3b82f6', '#10b981'],
      stroke: { curve: 'smooth', width: 2 },
      fill: { opacity: 0.15 },
      dataLabels: { enabled: false },
      xaxis: { categories: [] },
      yaxis: {
        min: 0,
        decimalsInFloat: 0,
        tickAmount: undefined,
        labels: {
          formatter: function(val: number) {
            return Math.round(val).toString();
          }
        },
        forceNiceScale: true
      },
      legend: { position: 'top' },
      grid: { borderColor: '#e2e8f0' }
    };
    chart2 = new ApexCharts(document.getElementById('trendChart'), lineOptions);
    chart2.render();

    updateCharts();
    models.subscribe(() => updateCharts());
  }

  function updateCharts() {
    if (!ApexLoaded) return;
    const stats = get(modelsByStatus);
    const series = [stats.PENDING, stats.IN_PROGRESS, stats.TRIAL, stats.DELIVERED, stats.CANCELLED];
    chart1?.updateSeries(series);

    const currentModels = get(models);
    const dates = getLastNDates(14);
    const addCounts = dates.map((d) =>
      currentModels.filter((m) => formatDate(m.createdAt) === d).length
    );
    const delCounts = dates.map((d) =>
      currentModels.filter(
        (m) => m.status === 'DELIVERED' && m.updatedAt && formatDate(m.updatedAt) === d
      ).length
    );
    chart2?.updateOptions({
      xaxis: { categories: dates.map((d) => d.slice(5)) }
    });
    chart2?.updateSeries([
      { name: '新增模型', data: addCounts },
      { name: '交付模型', data: delCounts }
    ]);
  }

  function goToModel(id: string) {
    goto(`/models/${id}`);
  }

  $: sortedOverdue = [...$overdueModels].sort(
    (a, b) => new Date(a.expectedDeliveryDate).getTime() - new Date(b.expectedDeliveryDate).getTime()
  );
</script>

<AppHeader />

<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
  <div class="mb-6">
    <h2 class="text-2xl font-bold text-slate-800 mb-1">统计看板</h2>
    <p class="text-sm text-slate-500">全局数据概览与制作进度监控</p>
  </div>

  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
    <StatCard title="模型总数" value={$models.length} icon="📦" gradient="from-slate-500 to-slate-600" subtitle="累计录入" />
    <StatCard title="待制作" value={$modelsByStatus.PENDING} icon="⏳" gradient="from-slate-400 to-slate-500" />
    <StatCard title="制作中" value={$modelsByStatus.IN_PROGRESS} icon="🔧" gradient="from-blue-500 to-blue-600" />
    <StatCard title="待试戴" value={$modelsByStatus.TRIAL} icon="👄" gradient="from-amber-500 to-amber-600" />
    <StatCard title="已交付" value={$modelsByStatus.DELIVERED} icon="✅" gradient="from-green-500 to-green-600" />
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <h3 class="text-base font-bold text-slate-800 mb-4">状态分布</h3>
      <div id="statusChart" class="w-full"></div>
    </div>
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <h3 class="text-base font-bold text-slate-800 mb-4">近14天趋势</h3>
      <div id="trendChart" class="w-full"></div>
    </div>
  </div>

  <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
      <div>
        <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
          <span class="text-warning-red-500">⚠️</span>
          延期预警
        </h3>
        <p class="text-xs text-slate-500 mt-0.5">
          共 {sortedOverdue.length} 个模型已延期，需及时处理
        </p>
      </div>
      <a href="/models" class="text-sm text-medical-blue-600 hover:underline font-medium">
        查看全部 →
      </a>
    </div>

    {#if sortedOverdue.length === 0}
      <div class="p-12 text-center">
        <div class="text-5xl mb-3">🎉</div>
        <p class="text-slate-500">暂无延期模型，做得很棒！</p>
      </div>
    {:else}
      <div class="divide-y divide-slate-100">
        {#each sortedOverdue as model}
          <button
            type="button"
            class="w-full px-5 py-3 hover:bg-warning-red-50/50 transition-colors cursor-pointer flex items-center justify-between text-left"
            on:click={() => goToModel(model.id)}
          >
            <div class="flex items-center gap-3">
              <span class="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {model.modelNo}
              </span>
              <div>
                <p class="font-medium text-slate-800">{model.patientName}</p>
                <p class="text-xs text-slate-500">
                  {DENTURE_TYPE_LABEL[model.dentureType]} · 负责人: {model.responsiblePerson}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <StatusBadge status={model.status} />
              <div class="text-right">
                <p class="text-sm font-semibold text-warning-red-600">
                  延期 {Math.abs(daysRemaining(model.expectedDeliveryDate))} 天
                </p>
                <p class="text-xs text-slate-400">
                  应交付: {formatDate(model.expectedDeliveryDate)}
                </p>
              </div>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</main>
