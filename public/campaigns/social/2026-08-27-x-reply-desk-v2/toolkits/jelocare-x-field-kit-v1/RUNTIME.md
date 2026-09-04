# Render runtime

The editorial core needs no software install. Actual Zapshot rendering needs
Python 3.9+ and FFmpeg with `libx264`, AAC, `drawtext`, `alphamerge`,
`palettegen`, and `paletteuse`.

The renderer searches in this order:

1. `--ffmpeg /path/to/ffmpeg`;
2. `FFMPEG_BINARY`;
3. a system `ffmpeg` on `PATH`;
4. the binary supplied by `imageio-ffmpeg`.

Portable fallback:

```bash
python3 -m pip install -r requirements.txt
python3 scripts/self_test.py
```

Then copy `templates/zapshot-recipe.json` beside an `assets/` directory, fill
the real literal crop coordinates, and run:

```bash
python3 scripts/render_zapshot.py path/to/zapshot-recipe.json
```

Exact encoded bytes can differ between FFmpeg builds and operating systems.
The recipe, source hashes, static construction boundary, audio presence, output
properties, and local output hashes remain auditable. Promise byte-identical
rebuilds only inside an explicitly locked runtime.
