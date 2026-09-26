<script setup lang="ts">
import ThemeToggle from '@/components/ThemeToggle.vue'
</script>

<template>
  <header class="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
    <nav class="mx-auto flex max-w-7xl items-center gap-6 px-4 py-4" aria-label="Main navigation">
      <RouterLink to="/" class="text-lg font-bold text-gray-950 dark:text-white">Watch Shelf</RouterLink>

      <div class="flex gap-4 text-sm font-medium">
        <RouterLink
          to="/"
          class="text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white"
          active-class="text-black dark:text-white"
          exact-active-class="text-black dark:text-white"
        >
          Discover
        </RouterLink>

        <RouterLink
          to="/library"
          class="text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white"
          active-class="text-black dark:text-white"
        >
          Library
        </RouterLink>
      </div>

      <ThemeToggle />
    </nav>
  </header>

  <RouterView />
</template>
