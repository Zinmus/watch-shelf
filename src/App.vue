<script setup lang="ts"></script>

<template>
  <header class="border-b border-gray-200 bg-white">
    <nav class="mx-auto flex max-w-7xl items-center gap-6 px-4 py-4" aria-label="Main navigation">
      <RouterLink to="/" class="text-lg font-bold">Watch Shelf</RouterLink>

      <div class="flex gap-4 text-sm font-medium">
        <RouterLink
          to="/"
          class="text-gray-600 hover:text-black"
          active-class="text-black"
          exact-active-class="text-black"
        >
          Discover
        </RouterLink>

        <RouterLink
          to="/library"
          class="text-gray-600 hover:text-black"
          active-class="text-black"
        >
          Library
        </RouterLink>
      </div>
    </nav>
  </header>

  <RouterView />
</template>
