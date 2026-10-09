<!-- Carte d'un échange : sa face si le joueur la possède, sinon son dos avec son numéro. -->
<script setup lang="ts">
import { formatNumber, type SharedCard } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import CardView from '@/components/card/CardView.vue'
import CardBack from '@/components/booster/CardBack.vue'

defineProps<{ item: SharedCard }>()

const store = useCardsStore()
</script>

<template>
  <CardView v-if="item.card" :card="item.card" :category="store.getCategory(item.categoryId)" />
  <CardBack
    v-else
    :label="item.number != null ? `N° ${formatNumber(item.number)}` : undefined"
    :color="store.getCategory(item.categoryId)?.color"
  />
</template>
