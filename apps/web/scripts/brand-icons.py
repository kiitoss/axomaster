"""Décline l'emblème fourni en ressources web et icônes PWA, sans le redessiner."""

from base64 import b64encode
from io import BytesIO
from pathlib import Path

from PIL import Image


WEB = Path(__file__).resolve().parents[1]
SOURCE = WEB / "branding" / "axolotl-crest.png"
PUBLIC = WEB / "public"
ASSETS = WEB / "src" / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)
crest = Image.open(SOURCE).convert("RGBA")

# Taille suffisante pour les boosters et les filigranes, avec transparence.
web_logo = crest.copy()
web_logo.thumbnail((768, 768), Image.Resampling.LANCZOS)
web_logo.save(ASSETS / "axolotl-crest.webp", quality=92, method=6)


def icon(size, inset=0.04, background=(0, 0, 0, 0)):
    canvas = Image.new("RGBA", (size, size), background)
    artwork = crest.copy()
    available = round(size * (1 - inset * 2))
    artwork.thumbnail((available, available), Image.Resampling.LANCZOS)
    canvas.alpha_composite(artwork, ((size - artwork.width) // 2, (size - artwork.height) // 2))
    return canvas


for size in (192, 512):
    icon(size).save(PUBLIC / f"icon-{size}.png", optimize=True)

# Tout le logo est dans la zone sûre centrale (cercle de rayon 40 % de l'icône).
icon(512, inset=0.22, background=(201, 192, 255, 255)).save(
    PUBLIC / "icon-maskable-512.png", optimize=True
)
icon(180, inset=0.09, background=(201, 192, 255, 255)).save(
    PUBLIC / "apple-touch-icon.png", optimize=True
)

# Android utilise seulement la silhouette alpha pour le badge de notification.
badge = icon(96)
silhouette = Image.new("RGBA", badge.size, "white")
silhouette.putalpha(badge.getchannel("A"))
silhouette.save(PUBLIC / "badge-96.png", optimize=True)

favicon = BytesIO()
icon(64, inset=0).save(favicon, format="PNG", optimize=True)
encoded = b64encode(favicon.getvalue()).decode("ascii")
(PUBLIC / "favicon.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n'
    f'  <image width="64" height="64" href="data:image/png;base64,{encoded}"/>\n'
    '</svg>\n',
    encoding="utf-8",
)

print("Emblème web, favicon et 5 icônes générés.")
