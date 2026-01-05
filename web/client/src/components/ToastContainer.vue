<script setup>
import { useToast } from '../composables/useToast'
import Toast from './Toast.vue'

const { toasts, remove } = useToast()
</script>

<template>
  <div class="fixed top-20 right-4 z-[100] flex flex-col items-end w-full max-w-sm pointer-events-none space-y-2">
    <TransitionGroup 
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform translate-x-full opacity-0"
      enter-to-class="transform translate-x-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-x-0 opacity-100"
      leave-to-class="transform translate-x-full opacity-0"
    >
      <div v-for="toast in toasts" :key="toast.id" class="pointer-events-auto w-full">
        <Toast 
          v-bind="toast" 
          :onClose="remove" 
        />
      </div>
    </TransitionGroup>
  </div>
</template>
