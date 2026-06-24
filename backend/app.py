from flask import Flask, request, send_file
from flask_cors import CORS
import fitz
import io

app = Flask(__name__)
CORS(app)

def sample_background_color(page, rect):
    """Sample the background color behind a text region"""
    # Render just that small area as an image at high resolution
    clip = fitz.Rect(rect.x0 - 1, rect.y0 - 1, rect.x1 + 1, rect.y1 + 1)
    mat = fitz.Matrix(3, 3)  # 3x zoom for accuracy
    pix = page.get_pixmap(matrix=mat, clip=clip)
    
    # Sample color from the very edge of the rect (not where text is)
    # We sample from top-left corner which is likely background
    samples = []
    
    # Sample multiple points around the border
    border_points = [
        (0, 0),
        (pix.width - 1, 0),
        (0, pix.height - 1),
        (pix.width - 1, pix.height - 1),
    ]
    
    for px, py in border_points:
        try:
            pixel = pix.pixel(px, py)
            samples.append(pixel)
        except:
            pass
    
    if not samples:
        return (1, 1, 1)  # Default white
    
    # Average the sampled colors
    r = sum(s[0] for s in samples) / len(samples) / 255
    g = sum(s[1] for s in samples) / len(samples) / 255
    b = sum(s[2] for s in samples) / len(samples) / 255
    
    return (r, g, b)

def get_text_color(span):
    """Extract text color from span"""
    color_int = span["color"]
    r = ((color_int >> 16) & 0xFF) / 255
    g = ((color_int >> 8) & 0xFF) / 255
    b = (color_int & 0xFF) / 255
    return (r, g, b)

@app.route("/replace-text", methods=["POST"])
def replace_text():
    if "pdf" not in request.files:
        return {"error": "No PDF uploaded"}, 400

    pdf_file = request.files["pdf"]
    search_text = request.form.get("search", "")
    replace_text_val = request.form.get("replace", "")

    if not search_text or not replace_text_val:
        return {"error": "Search and replace text required"}, 400

    pdf_bytes = pdf_file.read()
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    for page in doc:
        instances = page.search_for(search_text)

        if not instances:
            continue

        for inst in instances:
            # Get text properties
            words = page.get_text("dict", clip=inst)
            
            font_size = 11
            text_color = (0, 0, 0)
            original_text = search_text

            for block in words.get("blocks", []):
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        if search_text in span["text"]:
                            font_size = span["size"]
                            text_color = get_text_color(span)
                            original_text = span["text"]

            # Sample background color behind the text
            bg_color = sample_background_color(page, inst)

            # Cover old text with sampled background color
            page.draw_rect(
                inst,
                color=bg_color,
                fill=bg_color
            )

            # Write new text with original text color
            new_text = original_text.replace(search_text, replace_text_val)
            page.insert_text(
                (inst.x0, inst.y1 - 2),
                new_text,
                fontsize=font_size,
                color=text_color,
                fontname="helv"
            )

    output = io.BytesIO()
    doc.save(output)
    doc.close()
    output.seek(0)

    return send_file(
        output,
        mimetype="application/pdf",
        as_attachment=True,
        download_name="edited.pdf"
    )

if __name__ == "__main__":
    app.run(debug=True, port=5000)