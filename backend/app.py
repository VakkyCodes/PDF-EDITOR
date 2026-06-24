from flask import Flask, request, send_file
from flask_cors import CORS
import fitz  # PyMuPDF
import io
import os

app = Flask(__name__)
CORS(app)

@app.route("/replace-text", methods=["POST"])
def replace_text():
    if "pdf" not in request.files:
        return {"error": "No PDF uploaded"}, 400

    pdf_file = request.files["pdf"]
    search_text = request.form.get("search", "")
    replace_text = request.form.get("replace", "")

    if not search_text or not replace_text:
        return {"error": "Search and replace text required"}, 400

    # Read PDF into memory - never saved to disk
    pdf_bytes = pdf_file.read()
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    for page in doc:
        # Find all instances of search text
        instances = page.search_for(search_text)
        
        for inst in instances:
            # Get the text properties at this location
            words = page.get_text("dict", clip=inst)
            
            for block in words.get("blocks", []):
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        if search_text in span["text"]:
                            # Extract exact font properties
                            font_size = span["size"]
                            font_color = span["color"]
                            font_name = span["font"]
                            
                            # Convert color from int to RGB
                            r = ((font_color >> 16) & 0xFF) / 255
                            g = ((font_color >> 8) & 0xFF) / 255
                            b = (font_color & 0xFF) / 255

                            # Cover old text with white rectangle
                            page.draw_rect(inst, color=(1, 1, 1), fill=(1, 1, 1))

                            # Draw new text with exact same properties
                            page.insert_text(
                                (inst.x0, inst.y1 - 2),
                                span["text"].replace(search_text, replace_text),
                                fontsize=font_size,
                                color=(r, g, b),
                                fontname="helv"
                            )

    # Save to memory, never to disk
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