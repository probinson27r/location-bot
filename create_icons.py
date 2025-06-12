#!/usr/bin/env python3

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("PIL not available, creating simple files")
    # Create minimal PNG files
    import struct
    
    def create_simple_png(width, height, color, filename):
        # Create a minimal PNG file
        with open(filename, 'wb') as f:
            # PNG signature
            f.write(b'\x89PNG\r\n\x1a\n')
            # IHDR chunk
            f.write(struct.pack('>I', 13))  # chunk length
            f.write(b'IHDR')
            f.write(struct.pack('>II', width, height))
            f.write(b'\x08\x02\x00\x00\x00')  # bit depth, color type, compression, filter, interlace
            # CRC (simplified)
            f.write(b'\x00\x00\x00\x00')
            # IEND chunk
            f.write(struct.pack('>I', 0))
            f.write(b'IEND')
            f.write(b'\xaeB`\x82')
    
    create_simple_png(192, 192, (0, 120, 212), 'teams-package/color.png')
    create_simple_png(32, 32, (255, 255, 255), 'teams-package/outline.png')
    print("Simple PNG files created")
    exit()

# Create color icon (192x192)
img = Image.new('RGB', (192, 192), color='#0078D4')
draw = ImageDraw.Draw(img)

# Draw a simple location pin
draw.ellipse([76, 56, 116, 96], fill='white')
draw.ellipse([86, 66, 106, 86], fill='#0078D4')
draw.polygon([(96, 96), (86, 116), (106, 116)], fill='white')

img.save('teams-package/color.png')
print("Color icon saved: teams-package/color.png")

# Create outline icon (32x32) with transparent background
img2 = Image.new('RGBA', (32, 32), color=(0, 0, 0, 0))
draw2 = ImageDraw.Draw(img2)

# Draw simple white outline location pin
draw2.ellipse([12, 8, 20, 16], outline='white', width=2)
draw2.polygon([(16, 16), (14, 20), (18, 20)], fill='white')

img2.save('teams-package/outline.png')
print("Outline icon saved: teams-package/outline.png")

print("Icons created successfully!") 