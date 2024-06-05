<template>
  <div class="relative bg-white">
    <div class="lg:absolute lg:inset-0 lg:left-1/2">
      <img class="h-64 w-full bg-gray-50 object-cover sm:h-80 lg:absolute lg:h-full" src="https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&crop=focalpoint&fp-x=.4&w=2560&h=3413&&q=80" alt="Contact PCL Labs" />
    </div>
    <div class="pb-24 pt-16 sm:pb-32 sm:pt-24 lg:mx-auto lg:grid lg:max-w-7xl lg:grid-cols-2 lg:pt-32">
      <div class="px-6 lg:px-8">
        <div class="mx-auto max-w-xl lg:mx-0 lg:max-w-lg">
          <h2 class="text-3xl font-bold tracking-tight text-gray-900">Let's work together</h2>
          <p class="mt-2 text-lg leading-8 text-gray-600">PCL-Labs provides full-funnel marketing and advertising from brand positioning, research, data science and full-stack development to video/photo content, and more!</p>
          <form
            @submit.prevent="submitForm"
            method="POST"
          >
            <div class="mt-8 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
              <div>
                <label for="first-name" class="block text-sm font-semibold leading-6 text-gray-900">First name</label>
                <div class="mt-2.5">
                  <input type="text" name="first-name" id="first-name" autocomplete="given-name" class="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                </div>
              </div>
              <div>
                <label for="last-name" class="block text-sm font-semibold leading-6 text-gray-900">Last name</label>
                <div class="mt-2.5">
                  <input type="text" name="last-name" id="last-name" autocomplete="family-name" class="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                </div>
              </div>
              <div class="sm:col-span-2">
                <label for="email" class="block text-sm font-semibold leading-6 text-gray-900">Email</label>
                <div class="mt-2.5">
                  <input required id="email" name="email" type="email" autocomplete="email" class="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                </div>
              </div>
              <div class="sm:col-span-2">
                <label for="company" class="block text-sm font-semibold leading-6 text-gray-900">Company</label>
                <div class="mt-2.5">
                  <input type="text" name="company" id="company" autocomplete="organization" class="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                </div>
              </div>
              <div class="sm:col-span-2">
                <div class="flex justify-between text-sm leading-6">
                  <label for="phone" class="block font-semibold text-gray-900">Phone</label>
                  <p id="phone-description" class="text-gray-400">Optional</p>
                </div>
                <div class="mt-2.5">
                  <input type="tel" name="phone" id="phone" autocomplete="tel" aria-describedby="phone-description" class="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                </div>
              </div>
              <div class="sm:col-span-2">
                <div class="flex justify-between text-sm leading-6">
                  <label for="message" class="block text-sm font-semibold leading-6 text-gray-900">How can we help you?</label>
                  <p id="message-description" class="text-gray-400">{{ messageLength }}/500</p>
                </div>
                <div class="mt-2.5">
                  <textarea
      id="message"
      name="message"
      rows="4"
      aria-describedby="message-description"
      class="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
      @input="updateMessageLength"
      maxlength="500"
    />
                </div>
              </div>
              <button
                type="submit"
                :class="{
                  'bg-indigo-600': !loading,
                  'bg-gray-400 cursor-not-allowed': loading
                }"
                class="flex items-center justify-center rounded-md px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                :disabled="loading"
              >
                <div v-if="!loading">Send message</div>
                <div v-else class="flex items-center">
                  <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Sending...</span>
                </div>
              </button>
            <p class=" text-sm leading-6 text-gray-500">By submitting this form, I agree to the <a href="/privacy" class="font-semibold text-indigo-600">privacy&nbsp;policy</a>.</p>
            <input type="hidden" name="_captcha" value="false">
            <!-- <input type="hidden" name="_next" value="https://paulchrisluke.com/thank-you"> -->
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useNuxtApp } from '#app'

const { gtag } = useNuxtApp()
const { analytics } = useNuxtApp()
const router = useRouter()
const messageLength = ref(0)
const loading = ref(false)

const submitForm = async (event) => {
  event.preventDefault()
  loading.value = true
  try {
    const response = await fetch('https://formsubmit.co/541fa0e60b64234d706007fc6a64d0f9', {
      method: 'POST',
      body: new FormData(event.target),
    })
    if (response.ok) {
      // Form submitted successfully, track the event
      gtag && gtag('event', 'form_submitted', {
        event_category: 'contact_form',
        event_label: 'Contact Form Submission'
      })
      analytics && analytics.track('form_submitted', {
        category: 'contact_form',
        label: 'Contact Form Submission'
      })
      router.push('/thank-you')
    } else {
      console.error('Form submission failed:', response.statusText)
    }
  } catch (error) {
    console.error('Error submitting form:', error)
  } finally {
    loading.value = false
  }
}

const updateMessageLength = (event) => {
  messageLength.value = event.target.value.length
}
</script>
