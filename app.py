import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import uvicorn
from extractor import InvoiceExtractor
import json

load_dotenv()

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Extractor
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY not found in environment variables.")

extractor = InvoiceExtractor(GEMINI_API_KEY) if GEMINI_API_KEY else None

@app.post("/extract")
async def extract_invoice(file: UploadFile = File(...)):
    if not extractor:
        raise HTTPException(status_code=500, detail="Gemini API Key not configured.")
    
    filename = file.filename.lower()
    is_pdf = filename.endswith(".pdf")
    is_image = any(filename.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp"])
    
    if not (is_pdf or is_image):
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload PDF, PNG, or JPG.")
    
    try:
        content = await file.read()
        mime_type = "application/pdf" if is_pdf else file.content_type
        # Fallback for mime type
        if not mime_type or mime_type == "application/octet-stream":
            if filename.endswith(".png"): mime_type = "image/png"
            elif filename.endswith(".webp"): mime_type = "image/webp"
            else: mime_type = "image/jpeg"

        details = await extractor.extract_details(content, is_pdf=is_pdf, mime_type=mime_type)
        return details
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/save")
async def save_invoice(data: dict):
    print(f"Received save request for: {data.get('vendor_name')}")
    try:
        os.makedirs("data", exist_ok=True)
        import json
        from datetime import datetime
        
        # Ensure saved_at is present in the data for the frontend to use
        if "saved_at" not in data:
            data["saved_at"] = datetime.now().strftime("%m/%d/%Y, %I:%M:%S %p")
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        filename = f"data/invoice_{timestamp}.json"
        
        with open(filename, "w") as f:
            json.dump(data, f, indent=4)
            
        print(f"Successfully saved to {filename}")
        return {"status": "success", "message": f"Invoice saved successfully!", "file": filename}
    except Exception as e:
        print(f"Error saving invoice: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/invoices")
async def get_invoices():
    try:
        if not os.path.exists("data"):
            return []
        
        invoices = []
        import json
        for filename in os.listdir("data"):
            if filename.endswith(".json"):
                path = os.path.join("data", filename)
                try:
                    with open(path, "r") as f:
                        invoice_data = json.load(f)
                        # Store the filename so we can delete it later
                        invoice_data["id"] = filename
                        invoices.append(invoice_data)
                except Exception as e:
                    print(f"Error reading {filename}: {e}")
        return invoices
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/delete/{filename}")
async def delete_invoice(filename: str):
    try:
        path = os.path.join("data", filename)
        if os.path.exists(path):
            os.remove(path)
            return {"status": "success", "message": "Invoice deleted"}
        else:
            raise HTTPException(status_code=404, detail="Invoice not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "healthy", "api_key_configured": extractor is not None}

# Serve static files (frontend)
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
