<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { get } from 'svelte/store';
  import AppHeader from '$components/AppHeader.svelte';
  import StatCard from '$components/StatCard.svelte';
  import StatusBadge from '$components/StatusBadge.svelte';
  import { models, modelsByStatus, overdueModels, upcomingModels, delayReasonStats, totalRescheduleCount, upcomingAndOverdueModels, pendingQualityInspectionCount, qualityInspectionPassRate, totalReworkCount, activeReworkCount, thisWeekBatchOperationCount, thisWeekBatchModifiedModelCount, mostUsedBatchActionType } from '$lib/store';
  import type { Model } from '$lib/types';
  import { DENTURE_TYPE_LABEL } from '$lib/types';
  import { formatDate, daysRemaining, getLastNDates } from '$lib/formatters';
  import { getDeliveryStatusInfo } from '$lib/domain/deliveryRules';
  import { goto } from '$app/navigation';

  let chart1: any;
  let chart2: any;
  let chart3: any;
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

    const barOptions = {
      series: [{ name: '模型数量', data: [] }],
      chart: { type: 'bar', height: 280, width: '100%', toolbar: { show: false } },
      colors: ['#f59e0b'],
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 6,
          barHeight: '50%'
        }
      },
      dataLabels: {
        enabled: true,
        position: 'right',
        style: { colors: ['#475569'] }
      },
      xaxis: {
        categories: [],
        labels: {
          formatter: function(val: number) {
            return Math.round(val).toString();
          }
        },
        min: 0,
        tickAmount: undefined,
        forceNiceScale: true
      },
      yaxis: { labels: { style: { fontSize: '12px' } } },
      grid: { borderColor: '#e2e8f0' }
    };
    chart3 = new ApexCharts(document.getElementById('delayReasonChart'), barOptions);
    chart3.render();

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

    const reasonStats = get(delayReasonStats);
    const reasonLabels = Object.keys(reasonStats);
    const reasonValues = Object.values(reasonStats);
    if (reasonLabels.length > 0) {
      chart3?.updateOptions({
        xaxis: { categories: reasonLabels }
      });
      chart3?.updateSeries([{ name: '模型数量', data: reasonValues }]);
    }
  }

  function goToModel(id: string) {
    goto(`/models/${id}`);
  }

  $: sortedOverdue = [...$overdueModels].sort(
    (a, b) => new Date(a.expectedDeliveryDate).getTime() - new Date(b.expectedDeliveryDate).getTime()
  );

  $: sortedUpcoming = [...$upcomingModels].sort(
    (a, b) => new Date(a.expectedDeliveryDate).getTime() - new Date(b.expectedDeliveryDate).getTime()
  );

  $: sortedAlerts = [...$upcomingAndOverdueModels].sort(
    (a, b) => new Date(a.expectedDeliveryDate).getTime() - new Date(b.expectedDeliveryDate).getTime()
  );

  $: passRateSubtitle = (() => {
    if ($qualityInspectionPassRate.total === 0) return '暂无质检数据';
    return '通过 ' + $qualityInspectionPassRate.passed + ' / 共 ' + $qualityInspectionPassRate.total;
  })();

  function getAlertItemStatus(model: Model) {
    const info = getDeliveryStatusInfo(model);
    return {
      deliveryStatus: info.status,
      remaining: info.remainingDays,
      isOverdue: info.isOverdue
    };
  }
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

  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 mb-6">
    <StatCard title="即将到期" value={$upcomingModels.length} icon="⏰" gradient="from-amber-500 to-amber-600" subtitle="提醒日内到期" />
    <StatCard title="已延期" value={$overdueModels.length} icon="⚠️" gradient="from-warning-red-500 to-warning-red-600" subtitle="需及时处理" />
    <StatCard title="重新约期次数" value={$totalRescheduleCount} icon="📅" gradient="from-purple-500 to-purple-600" subtitle="累计变更交付日期" />
  </div>

  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <StatCard title="待质检数量" value={$pendingQualityInspectionCount} icon="🔍" gradient="from-orange-500 to-orange-600" subtitle="需及时安排验收" />
    <StatCard title="质检通过率" value={$qualityInspectionPassRate.total > 0 ? ($qualityInspectionPassRate.rate + '%') : '-'} icon="✅" gradient="from-teal-500 to-teal-600" subtitle={passRateSubtitle} />
    <StatCard title="返工中" value={$activeReworkCount} icon="🛠️" gradient="from-amber-500 to-amber-600" subtitle="正在整改中" />
    <StatCard title="返工次数" value={$totalReworkCount} icon="🔄" gradient="from-red-500 to-red-600" subtitle="累计质检不通过次数" />
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
    <StatCard
      title="本周批量操作次数"
      value={$thisWeekBatchOperationCount}
      icon="📦"
      gradient="from-indigo-500 to-indigo-600"
      subtitle="本周内执行的批量操作"
    />
    <StatCard
      title="批量修改模型数"
      value={$thisWeekBatchModifiedModelCount}
      icon="📋"
      gradient="from-violet-500 to-violet-600"
      subtitle="本周内批量修改的模型数量"
    />
    <StatCard
      title="最常用批量操作类型"
      value={$mostUsedBatchActionType.count > 0 ? $mostUsedBatchActionType.label : '-'}
      icon="⭐"
      gradient="from-fuchsia-500 to-fuchsia-600"
      subtitle={$mostUsedBatchActionType.count > 0 ? `累计使用 ${$mostUsedBatchActionType.count} 次` : '暂无批量操作数据'}
    />
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

  <div class="grid grid-cols-1 lg:grid-cols-1 gap-6 mb-6">
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <h3 class="text-base font-bold text-slate-800 mb-4">延期原因分布</h3>
      {#if Object.keys($delayReasonStats).length === 0}
        <div class="py-12 text-center">
          <div class="text-4xl mb-3">📊</div>
          <p class="text-slate-500 text-sm">暂无延期原因数据</p>
        </div>
      {:else}
        <div id="delayReasonChart" class="w-full"></div>
      {/if}
    </div>
  </div>

  <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
      <div>
        <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
          <span class="text-amber-500">🔔</span>
          交付提醒与延期预警
        </h3>
        <p class="text-xs text-slate-500 mt-0.5">
          即将到期 {sortedUpcoming.length} 个 · 已延期 {sortedOverdue.length} 个，共 {sortedAlerts.length} 个模型需关注
        </p>
      </div>
      <a href="/models" class="text-sm text-medical-blue-600 hover:underline font-medium">
        查看全部 →
      </a>
    </div>

    {#if sortedAlerts.length === 0}
      <div class="p-12 text-center">
        <div class="text-5xl mb-3">🎉</div>
        <p class="text-slate-500">暂无需要提醒或延期的模型，做得很棒！</p>
      </div>
    {:else}
      <div class="divide-y divide-slate-100">
        {#each sortedAlerts as model (model.id)}
          <button
            type="button"
            class="w-full px-5 py-3 transition-colors cursor-pointer flex items-center justify-between text-left {getAlertItemStatus(model).isOverdue ? 'hover:bg-warning-red-50/50' : 'hover:bg-amber-50/50'}"
            on:click={() => goToModel(model.id)}
          >
            <div class="flex items-center gap-3">
              <span class="text-sm font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {model.modelNo}
              </span>
              <div>
                <div class="flex items-center gap-2">
                  <p class="font-medium text-slate-800">{model.patientName}</p>
                  {#if model.reminded}
                    <span class="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full border border-green-200">已提醒</span>
                  {/if}
                </div>
                <p class="text-xs text-slate-500">
                  {DENTURE_TYPE_LABEL[model.dentureType]} · 负责人: {model.responsiblePerson}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <StatusBadge status={model.status} />
              <div class="text-right">
                <p class="text-sm font-semibold {getAlertItemStatus(model).isOverdue ? 'text-warning-red-600' : 'text-amber-600'}">
                  {#if getAlertItemStatus(model).isOverdue}
                    延期 {Math.abs(getAlertItemStatus(model).remaining)} 天
                  {:else if getAlertItemStatus(model).remaining === 0}
                    今日到期
                  {:else}
                    剩余 {getAlertItemStatus(model).remaining} 天
                  {/if}
                </p>
                <p class="text-xs text-slate-400">
                  预计交付: {formatDate(model.expectedDeliveryDate)}
                </p>
              </div>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</main>
