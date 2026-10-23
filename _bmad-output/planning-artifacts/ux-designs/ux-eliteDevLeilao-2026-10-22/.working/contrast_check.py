"""Reproduce contrast ratios for the existing opaque palette pairs."""
import json

def luminance(color):
    channels = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in channels]
    return sum(x * weight for x, weight in zip(linear, (0.2126, 0.7152, 0.0722)))

pairs = [
    ('rotuloRelogio / painel claro', '#8A8273', '#141311'),
    ('BRASIL decorativo / faixa logo', '#FFFFFF', '#E2A514'),
    ('sobreCor / verde claro', '#F5EEDF', '#2E6A3E'),
    ('sobreCor / ferrugem claro', '#F5EEDF', '#A43C1E'),
    ('ferrugem / papel noite', '#E36A43', '#262420'),
    ('sobreCor / verde noite', '#161513', '#74B585'),
    ('sobreCor / ferrugem noite', '#161513', '#E36A43'),
]
results = []
for label, foreground, background in pairs:
    low, high = sorted((luminance(foreground), luminance(background)))
    results.append({'pair': label, 'foreground': foreground, 'background': background, 'ratio': round((high + .05) / (low + .05), 2)})
print(json.dumps({'scope': 'opaque palette pairs only; no rendered UI audit', 'results': results}, ensure_ascii=False, indent=2))
