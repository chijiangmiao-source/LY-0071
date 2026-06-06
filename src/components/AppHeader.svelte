<script lang="ts">
  import { page } from '$app/stores';

  const navItems = [
    { href: '/', label: '统计看板', icon: '📊' },
    { href: '/models', label: '模型列表', icon: '📋' },
    { href: '/models/new', label: '新增模型', icon: '➕' }
  ];
</script>

<header class="bg-gradient-to-r from-medical-blue-700 to-medical-blue-600 text-white shadow-lg">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
          🦷
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-wide">牙科义齿模型流转看板</h1>
          <p class="text-xs text-blue-100">Denture Model Flow Tracker</p>
        </div>
      </div>
      <nav class="hidden md:flex items-center gap-1">
        {#each navItems as item}
          <a
            href={item.href}
            class="px-4 py-2 rounded-lg text-sm font-medium transition-all {
              $page.url.pathname === item.href
                ? 'bg-white/20 shadow-inner'
                : 'hover:bg-white/10'
            }"
          >
            <span class="mr-1.5">{item.icon}</span>
            {item.label}
          </a>
        {/each}
      </nav>
    </div>
  </div>
</header>

<nav class="md:hidden bg-white border-b border-slate-200 overflow-x-auto">
  <div class="flex px-2 py-2 gap-1">
    {#each navItems as item}
      <a
        href={item.href}
        class="flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all {
          $page.url.pathname === item.href
            ? 'bg-medical-blue-50 text-medical-blue-700'
            : 'text-slate-600 hover:bg-slate-100'
        }"
      >
        <span class="mr-1">{item.icon}</span>
        {item.label}
      </a>
    {/each}
  </div>
</nav>
