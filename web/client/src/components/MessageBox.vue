<script setup>
import { useMessageBox } from '../composables/useMessageBox'
import { AlertCircle, HelpCircle } from 'lucide-vue-next'

const { state, handleConfirm, handleCancel } = useMessageBox()
</script>

<template>
  <div v-if="state.visible" class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
      <div class="p-6">
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0">
            <AlertCircle v-if="state.type === 'alert'" class="w-6 h-6 text-blue-600" />
            <HelpCircle v-if="state.type === 'confirm'" class="w-6 h-6 text-yellow-500" />
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-medium text-gray-900">{{ state.title }}</h3>
            <div class="mt-2 text-sm text-gray-500">
              <p>{{ state.message }}</p>
            </div>
          </div>
        </div>
      </div>
      <div class="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
        <button 
          v-if="state.type === 'confirm'"
          @click="handleCancel"
          class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {{ state.cancelText }}
        </button>
        <button 
          @click="handleConfirm"
          class="px-4 py-2 text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {{ state.confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>
