<script setup lang="ts">
import { ref } from 'vue'

const quotes = [
  { text: 'I am Google Earth', author: 'Controla' },
  { text: 'Hijos de gilipollas', author: 'Avispas' },
]
const current = ref(0)
</script>

<template>
  <section
    class="participant-quotes"
    aria-label="Frases míticas de los participantes"
    aria-roledescription="carrusel"
  >
    <figure>
      <blockquote>“{{ quotes[current]!.text }}”</blockquote>
      <figcaption>{{ quotes[current]!.author }}</figcaption>
    </figure>
    <div class="quote-controls">
      <button
        v-for="(quote, index) in quotes"
        :key="quote.author"
        type="button"
        class="quote-dot"
        :aria-label="`Ver frase de ${quote.author}`"
        :aria-pressed="current === index"
        @click="current = index"
      >
        <span aria-hidden="true"></span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.participant-quotes {
  margin: 32px 0 8px;
  padding: 20px 12px 8px;
  text-align: center;
  border-top: 1px solid #d9b66525;
}
figure {
  margin: 0;
}
blockquote {
  margin: 0;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: Georgia, serif;
  font-size: clamp(15px, 3.2vw, 17px);
  line-height: 1.4;
  color: #f3d68d;
  overflow-wrap: anywhere;
}
figcaption {
  margin-top: 10px;
  color: var(--muted);
  font-size: 12px;
}
.quote-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 12px;
}
button {
  min-width: 44px;
  min-height: 44px;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.quote-dot span {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #8f8879;
}
.quote-dot[aria-pressed='true'] span {
  background: #f3d68d;
  box-shadow: 0 0 0 3px #d9b66525;
}
button:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
  border-radius: 6px;
}
</style>
