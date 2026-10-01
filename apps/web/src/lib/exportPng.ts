import { toBlob } from 'html-to-image'
import { CARD_HEIGHT, CARD_WIDTH } from '@axomaster/card-model'
import { downloadBlob, slugify } from './download'

/** Exporte l'élément `.inner` d'une CardView en PNG haute définition. */
export async function exportCardPng(inner: HTMLElement, name: string) {
  const blob = await toBlob(inner, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    pixelRatio: 2,
    style: { transform: 'none' },
    filter: (node) => !(node instanceof HTMLElement && node.classList.contains('holo')),
  })
  if (!blob) throw new Error('Export PNG impossible')
  downloadBlob(blob, `${slugify(name)}.png`)
}
