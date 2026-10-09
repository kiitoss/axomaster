<script setup lang="ts">
import { computed } from 'vue'
import type { Layer } from '@axomaster/card-model'
import { useImageUrl } from '@/composables/useImageUrl'

const props = defineProps<{ layer: Layer }>()

const imageUrl = useImageUrl(() => (props.layer.type === 'image' ? props.layer.imageId : null))

const box = computed(() => ({
  left: `${props.layer.x}%`,
  top: `${props.layer.y}%`,
  width: `${props.layer.w}%`,
  height: `${props.layer.h}%`,
  opacity: props.layer.opacity,
  transform: props.layer.rotation ? `rotate(${props.layer.rotation}deg)` : undefined,
}))

const textStyle = computed(() => {
  const l = props.layer
  if (l.type !== 'text') return {}
  return {
    fontFamily: l.font === 'serif' ? 'var(--font-serif)' : 'var(--font-sans)',
    fontSize: `${l.size}px`,
    fontWeight: l.weight,
    fontStyle: l.italic ? 'italic' : 'normal',
    textTransform: l.uppercase ? ('uppercase' as const) : ('none' as const),
    letterSpacing: `${l.letterSpacing}em`,
    textAlign: l.align,
    color: l.color,
  }
})

const shapeStyle = computed(() => {
  const l = props.layer
  if (l.type !== 'shape') return {}
  if (l.shape === 'line') {
    return {
      height: `${l.strokeWidth}px`,
      background: l.stroke,
      borderRadius: `${l.strokeWidth}px`,
    }
  }
  return {
    background: l.fill,
    border: l.strokeWidth ? `${l.strokeWidth}px solid ${l.stroke}` : 'none',
    borderRadius: l.shape === 'ellipse' ? '50%' : `${l.radius}px`,
  }
})
</script>

<template>
  <div class="layer" :style="box">
    <div v-if="layer.type === 'text'" class="text" :style="textStyle">{{ layer.text }}</div>
    <template v-else-if="layer.type === 'image'">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        alt=""
        draggable="false"
        :style="{ objectFit: layer.fit, borderRadius: `${layer.radius}px` }"
      />
    </template>
    <div v-else class="shape" :class="layer.shape" :style="shapeStyle" />
  </div>
</template>

<style scoped>
.layer {
  position: absolute;
  transform-origin: center;
}

.text {
  width: 100%;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  line-height: 1.15;
}

img {
  width: 100%;
  height: 100%;
  max-width: none;
}

.shape {
  width: 100%;
  height: 100%;
}

.shape.line {
  position: absolute;
  top: 50%;
  translate: 0 -50%;
}
</style>
