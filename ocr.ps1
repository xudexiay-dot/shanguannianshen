# OCR 截图识别脚本
# 使用方法：在终端输入  python ocr.py 截图文件路径
param($file)

python -c "
import pytesseract, sys
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
from PIL import Image
img = Image.open(r'$file')
text = pytesseract.image_to_string(img, lang='chi_sim+eng')
print(text if text.strip() else '(无文字)')
"