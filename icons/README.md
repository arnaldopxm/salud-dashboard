# Iconos del PWA

`icon-192.png` e `icon-512.png` — los que declara `manifest.json`.

- Fondo full-bleed `#0f0f1a`, cruz de salud `#6C8EF5`, centrada dentro de la
  safe-zone maskable (brazos a ~0.32 de la mitad < 0.40). Sin esquinas
  transparentes: el launcher aplica su propia forma (`purpose: "any maskable"`).
- Generados con `scripts/gen-icons.py` (solo stdlib, sin dependencias).
  Para regenerarlos: `python scripts/gen-icons.py` desde la raíz del repo.
