# Builds the website's pictures from the app's own screenshots and branding.
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W = r"D:\Development\BestChess\website\assets"
RAW = r"D:\Development\BestChess\store_shots\raw"
BR = r"D:\Development\BestChess\best_chess\branding"
for n in ["review", "summary", "pgn", "puzzles", "puzzle_hint", "academy", "lesson", "play", "settings", "boards", "home"]:
    im = Image.open(os.path.join(RAW, f"p_{n}.png")).convert("RGB")
    im = im.crop((0, 120, im.width, im.height - 70))  # status bar, gesture bar
    im = im.resize((540, int(im.height * 540 / im.width)), Image.LANCZOS)
    im.save(os.path.join(W, "screens", f"{n}.webp"), quality=82, method=6)
logo = Image.open(os.path.join(BR, "best_chess_logo.png")).convert("RGBA")
m = Image.new("L", logo.size, 0)
ImageDraw.Draw(m).rounded_rectangle([0, 0, logo.width - 1, logo.height - 1], radius=int(logo.width * 0.22), fill=255)
a = Image.fromarray(__import__("numpy").minimum(__import__("numpy").asarray(logo.getchannel("A")), __import__("numpy").asarray(m)))
logo.putalpha(a)
logo.resize((256, 256), Image.LANCZOS).save(os.path.join(W, "logo.webp"), quality=90)
logo.resize((180, 180), Image.LANCZOS).save(os.path.join(W, "apple-touch-icon.png"))
logo.resize((48, 48), Image.LANCZOS).save(os.path.join(W, "favicon.png"))
# Social preview 1200x630.
og = Image.new("RGB", (1200, 630), (22, 19, 16))
d = ImageDraw.Draw(og)
for y in range(630):
    t = y / 630
    d.line([(0, y), (1200, y)], fill=(int(42 - 22 * t), int(35 - 18 * t), int(28 - 14 * t)))
sq = 70
for r in range(10):
    for c in range(18):
        if (r + c) % 2 == 0:
            d.rectangle([c * sq, r * sq, c * sq + sq, r * sq + sq], fill=(46, 39, 31))
ov = Image.new("RGBA", (1200, 630), (22, 19, 16, 150)); og.paste(ov, (0, 0), ov)
og.paste(logo.resize((150, 150)), (70, 70), logo.resize((150, 150)))
F = os.path.join(W, "fonts", "PlayfairDisplay-VariableFont_wght.ttf")
f1 = ImageFont.truetype(F, 92); f1.set_variation_by_axes([900])
d = ImageDraw.Draw(og)
d.text((70, 250), "BEST CHESS", font=f1, fill=(212, 174, 110))
f2 = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 38)
for i, line in enumerate(["Unlimited game reviews.", "Puzzles with no daily limit.", "Offline. No ads. Free."]):
    d.text((74, 380 + i * 54), line, font=f2, fill=(239, 230, 216))
shot = Image.open(os.path.join(W, "screens", "review.webp")).convert("RGB")
shot = shot.resize((300, int(shot.height * 300 / shot.width)))
shot = shot.crop((0, 0, 300, 560))
mk = Image.new("L", shot.size, 0); ImageDraw.Draw(mk).rounded_rectangle([0, 0, 299, 559], radius=28, fill=255)
sh = Image.new("RGBA", (1200, 630), (0, 0, 0, 0)); ImageDraw.Draw(sh).rounded_rectangle([830, 50, 1150, 640], radius=30, fill=(0, 0, 0, 170))
sh = sh.filter(ImageFilter.GaussianBlur(18)); og.paste(sh, (0, 0), sh)
og.paste(shot, (820, 40), mk)
ImageDraw.Draw(og).rounded_rectangle([816, 36, 1124, 604], radius=32, outline=(212, 174, 110), width=6)
og.save(os.path.join(W, "og.png"), optimize=True)
print("ok")
