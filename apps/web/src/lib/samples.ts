import {
  createPack,
  createShapeLayer,
  createTextLayer,
  type Card,
  type CardPack,
  type Rarity,
} from '@axomaster/card-model'

/**
 * Paquet de démonstration : illustrations générées sur canvas (aucune ressource externe),
 * identifiants fixes pour que l'import répété ne crée pas de doublons.
 */
export function buildSamplePack(): CardPack {
  const images: Record<string, string> = {}
  const cards: Card[] = []
  const date = '2026-01-01T09:00:00.000Z'

  function add(
    slug: string,
    data: {
      name: string
      subtitle: string
      description: string
      categoryId: string
      rarity: Rarity
      number: number
      image: string
      layers?: Card['layers']
    },
  ) {
    const imageId = `sample-img-${slug}`
    images[imageId] = data.image
    cards.push({
      id: `sample-${slug}`,
      name: data.name,
      subtitle: data.subtitle,
      description: data.description,
      categoryId: data.categoryId,
      rarity: data.rarity,
      number: data.number,
      photo: { imageId, x: 50, y: 40, scale: 1 },
      layers: data.layers ?? [],
      author: 'Exemples',
      source: { kind: 'local' },
      createdAt: date,
      updatedAt: date,
    })
  }

  const stamp = createTextLayer('Tampon')
  Object.assign(stamp, {
    id: 'sample-layer-stamp',
    text: '1ʳᵉ édition',
    x: 58,
    y: 12.5,
    w: 34,
    h: 5,
    rotation: 8,
    size: 26,
    font: 'serif',
    italic: true,
    color: '#8b5cf6',
  })
  const stampLine = createShapeLayer('rect', 'Cadre du tampon')
  Object.assign(stampLine, {
    id: 'sample-layer-stamp-frame',
    x: 59,
    y: 12.2,
    w: 32,
    h: 5.6,
    rotation: 8,
    fill: 'rgba(255,250,240,0.85)',
    stroke: '#8b5cf6',
    strokeWidth: 2,
    radius: 4,
  })

  add('camille', {
    name: 'Camille Laurent',
    subtitle: 'Directrice technique',
    description:
      'Architecte des grandes migrations. Réputée pour transformer un monolithe en microservices avant le café de dix heures.',
    categoryId: 'collaborateurs',
    rarity: 'legendary',
    number: 1,
    image: portrait('CL', ['#3b4a63', '#8b5cf6']),
    layers: [stampLine, stamp],
  })
  add('hugo', {
    name: 'Hugo Mercier',
    subtitle: 'Développeur full-stack',
    description:
      'Capable de passer de Vue à Spring Boot sans changer de chaise. Son clavier mécanique s’entend depuis l’open space.',
    categoryId: 'collaborateurs',
    rarity: 'rare',
    number: 2,
    image: portrait('HM', ['#5f789f', '#d0d9e8']),
  })
  add('lea', {
    name: 'Léa Fontaine',
    subtitle: 'Designer UX / UI',
    description:
      'Gardienne des marges et des contrastes. Un pixel décalé ne lui échappe jamais, même en visio.',
    categoryId: 'collaborateurs',
    rarity: 'epic',
    number: 3,
    image: portrait('LF', ['#7c6198', '#ddd1e8']),
  })
  add('thomas', {
    name: 'Thomas Garnier',
    subtitle: 'Chef de projet',
    description:
      'Maître du rétroplanning. Transforme les imprévus en jalons et les réunions en décisions.',
    categoryId: 'collaborateurs',
    rarity: 'uncommon',
    number: 4,
    image: portrait('TG', ['#5d7d68', '#d3ded5']),
  })
  add('seminaire', {
    name: 'Séminaire au lac',
    subtitle: 'Annecy · juin 2026',
    description:
      'Trois jours de conférences, de randonnées et de débats passionnés sur les tabs contre les espaces.',
    categoryId: 'evenements',
    rarity: 'epic',
    number: 1,
    image: landscape(['#1f3b57', '#7fa3c0', '#ddd6fe']),
  })
  add('hackathon', {
    name: 'Hackathon de printemps',
    subtitle: 'Lyon · mars 2026',
    description:
      '24 heures, 9 équipes, 3 pizzas par personne et une démo qui a marché du premier coup.',
    categoryId: 'evenements',
    rarity: 'rare',
    number: 2,
    image: geometric(['#0f172a', '#8b5cf6', '#ede9fe']),
  })
  add('afterwork', {
    name: 'Afterwork d’été',
    subtitle: 'Terrasse · juillet 2026',
    description: 'Le soir où le baby-foot a enfin trouvé un adversaire à sa mesure.',
    categoryId: 'evenements',
    rarity: 'common',
    number: 3,
    image: sunset(['#e8a87c', '#c38d9e', '#41b3a3']),
  })

  return createPack({
    author: 'Exemples',
    cards,
    categories: [
      { id: 'collaborateurs', name: 'Collaborateurs', color: '#3f5d8c' },
      { id: 'evenements', name: 'Événements', color: '#8b5cf6' },
    ],
    images,
  })
}

function canvas(w = 800, h = 760) {
  const el = document.createElement('canvas')
  el.width = w
  el.height = h
  return { el, ctx: el.getContext('2d')!, w, h }
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, alpha = 0.05) {
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * alpha})`
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5)
  }
}

function portrait(initials: string, [dark, light]: [string, string]): string {
  const { el, ctx, w, h } = canvas()
  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, light)
  bg.addColorStop(1, '#f5f3ff')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = dark
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.ellipse(w / 2, h + 60, 300, 330, 0, Math.PI, 0)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(w / 2, h * 0.42, 130, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = '600 92px "Cormorant Garamond", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(initials, w / 2, h * 0.43)

  grain(ctx, w, h)
  return el.toDataURL('image/webp', 0.9)
}

function landscape([sky, lake, light]: [string, string, string]): string {
  const { el, ctx, w, h } = canvas()
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, light)
  bg.addColorStop(0.55, lake)
  bg.addColorStop(1, sky)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(255,248,225,0.9)'
  ctx.beginPath()
  ctx.arc(w * 0.7, h * 0.25, 60, 0, Math.PI * 2)
  ctx.fill()
  const ridges: [number, string][] = [
    [0.5, 'rgba(31,59,87,0.55)'],
    [0.6, 'rgba(31,59,87,0.8)'],
  ]
  for (const [base, color] of ridges) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, h)
    for (let x = 0; x <= w; x += 40) {
      ctx.lineTo(x, h * base - Math.abs(Math.sin(x / 90 + base * 9)) * 140)
    }
    ctx.lineTo(w, h)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(233,217,176,0.35)'
  ctx.fillRect(0, h * 0.78, w, 3)
  grain(ctx, w, h)
  return el.toDataURL('image/webp', 0.9)
}

function geometric([ink, gold, cream]: [string, string, string]): string {
  const { el, ctx, w, h } = canvas()
  ctx.fillStyle = ink
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = gold
  ctx.lineWidth = 2
  for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = 0.15 + i * 0.05
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 30 + i * 28, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = cream
  ctx.font = '600 120px "Cormorant Garamond", serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('{ }', w / 2, h / 2)
  grain(ctx, w, h, 0.08)
  return el.toDataURL('image/webp', 0.9)
}

function sunset([a, b, c]: [string, string, string]): string {
  const { el, ctx, w, h } = canvas()
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, a)
  bg.addColorStop(0.6, b)
  bg.addColorStop(1, c)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(255,240,210,0.85)'
  ctx.beginPath()
  ctx.arc(w / 2, h * 0.62, 150, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = 'rgba(29,27,24,0.75)'
  for (let i = 0; i < 6; i++) {
    const x = 90 + i * 125
    ctx.fillRect(x, h * 0.62, 6, h)
    ctx.beginPath()
    ctx.arc(x + 3, h * 0.62, 28, Math.PI, 0)
    ctx.fill()
  }
  grain(ctx, w, h)
  return el.toDataURL('image/webp', 0.9)
}
