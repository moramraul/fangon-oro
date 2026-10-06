<script setup lang="ts">
import { ref } from 'vue'

const quotes = [
  'Aquí ahora mismo se lleva cero unidades de respetar a tu esposa',
  'La de la espalda descubierta me la ha puesto como una morcilla muy grande. La líbido y la lábada.',
  'Le he dicho a una tía que somos restos de una civilización superior y que lo mejor que puede hacer es suicidarse',
  'Yo soy como un perro de la policía, solo para prostitutas y vicios... Huele a condón abierto.',
  'No puedes comparar un olor a cistitis con un olor a zapato de árabe.',
  'Tú no eres legal, tú tienes pinta de ser barely.',
  'Estoy llenando mi disco duro ocular de vaginas en el quirófano, que casualmente me ha tocado hoy en la zona ginecológica',
]
const current = ref(0)
const direction = ref('next')
const dragX = ref(0)
let touchStart: { x: number; y: number } | null = null

function showQuote(index: number, movement = index > current.value ? 'next' : 'previous') {
  direction.value = movement
  current.value = (index + quotes.length) % quotes.length
}

function startSwipe(event: TouchEvent) {
  const touch = event.touches[0]
  if (!touch || event.touches.length !== 1) return
  touchStart = { x: touch.clientX, y: touch.clientY }
  dragX.value = 0
}

function moveSwipe(event: TouchEvent) {
  const touch = event.touches[0]
  if (!touchStart || !touch) return
  if (event.touches.length !== 1) {
    cancelSwipe()
    return
  }
  const x = touch.clientX - touchStart.x
  const y = touch.clientY - touchStart.y
  if (Math.abs(y) > Math.abs(x) && Math.abs(y) > 10) {
    cancelSwipe()
    return
  }
  dragX.value = Math.max(-100, Math.min(100, x))
}

function endSwipe() {
  if (Math.abs(dragX.value) >= 40) {
    const next = dragX.value < 0
    showQuote(current.value + (next ? 1 : -1), next ? 'next' : 'previous')
  }
  cancelSwipe()
}

function cancelSwipe() {
  touchStart = null
  dragX.value = 0
}
</script>

<template>
  <section
    class="participant-quotes"
    aria-label="Frases míticas de los participantes"
    aria-roledescription="carrusel"
  >
    <h2 class="quote-heading">Los participantes han dicho…</h2>
    <figure
      @touchstart.passive="startSwipe"
      @touchmove.passive="moveSwipe"
      @touchend="endSwipe"
      @touchcancel="cancelSwipe"
    >
      <div class="quote-drag" :style="{ transform: `translateX(${dragX}px)` }">
        <Transition :name="`quote-${direction}`" mode="out-in">
          <blockquote :key="current">“{{ quotes[current] }}”</blockquote>
        </Transition>
      </div>
    </figure>
    <div class="quote-controls">
      <button
        v-for="(quote, index) in quotes"
        :key="quote"
        type="button"
        class="quote-dot"
        :aria-label="`Ver frase ${index + 1}`"
        :aria-pressed="current === index"
        @click="showQuote(index)"
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
.quote-heading {
  margin: 0 0 16px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
figure {
  margin: 0;
  overflow: hidden;
  touch-action: pan-y pinch-zoom;
}
.quote-next-enter-active,
.quote-next-leave-active,
.quote-previous-enter-active,
.quote-previous-leave-active {
  transition: transform 180ms ease, opacity 180ms ease;
}
.quote-next-enter-from,
.quote-previous-leave-to {
  transform: translateX(60px);
  opacity: 0;
}
.quote-next-leave-to,
.quote-previous-enter-from {
  transform: translateX(-60px);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .quote-drag {
    transform: none !important;
  }
  .quote-next-enter-active,
  .quote-next-leave-active,
  .quote-previous-enter-active,
  .quote-previous-leave-active {
    transition: none;
  }
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
.quote-controls {
  display: flex;
  flex-wrap: wrap;
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
