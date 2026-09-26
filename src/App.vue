<script setup lang="ts">
import ThemeToggle from '@/components/ThemeToggle.vue'
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <nav
        class="mx-auto flex max-w-7xl items-center gap-6 px-4 py-4"
        aria-label="Main navigation"
      >
        <RouterLink to="/" class="text-lg font-bold text-gray-950 dark:text-white">
          Watch Shelf
        </RouterLink>

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

    <div class="flex-1">
      <RouterView />
    </div>

    <footer class="border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <section
        class="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
        aria-labelledby="credits-heading"
      >
        <h2
          id="credits-heading"
          class="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400"
        >
          Credits
        </h2>

        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit The Movie Database (opens in a new tab)"
          class="w-fit rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 dark:focus-visible:outline-gray-300"
        >
          <img
            src="/assets/tmdb/tmdb-primary-full-blue.svg"
            alt="The Movie Database (TMDB)"
            class="h-7 w-auto"
          />
        </a>

        <p class="text-xs leading-5 text-gray-600 dark:text-gray-400">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </section>
    </footer>
  </div>
</template>
