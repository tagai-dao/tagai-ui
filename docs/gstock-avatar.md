# GStock official-page avatar

Contract: `0x97acca21fcf2435f1a0bfa94f9c27d412b88c1c8` (BSC).
Source: https://gang.fun/token/0x97acca21fcf2435f1a0bfa94f9c27d412b88c1c8

The page renders `<span class="tok-avatar">G</span>`, not an image element. Its computed 48px avatar has background RGB(33,56,80), border RGB(53,82,110), foreground RGB(201,224,247) and a centered 20.16px FP Latin G. The SVG converts that single glyph to a vector path; no external font, JavaScript, raster screenshot or unrelated same-symbol image is used.

The public file is served at `/token-logos/gstock-97acca21.svg`. API PR #167 uses it only for this exact verified imported contract when its logo is empty. A future official image overrides this fallback; the gang.fun platform badge remains separate. Deploy this public asset before deploying the API fallback. Agent Launch membership is already implemented by merged UI #223 / API #166 and also needs the current frontend release in production.
