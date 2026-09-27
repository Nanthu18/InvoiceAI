# InvoiceAI - Intelligent Extraction

Extract data from PDF invoices using Google Gemini AI.

## Features
- ✨ Modern, Premium UI with Glassmorphism
- 🤖 Powered by Google Gemini 1.5 Flash
- ⚡ Fast extraction of Vendor, Amount, Date, and Line Items
- 📑 Side-by-side preview and editable form

## Setup

1. **Install Dependencies** (Already done if you follow my setup):
   ```bash
   pip install -r requirements.txt
   ```

2. **Get a Gemini API Key**:
   - Go to [Google AI Studio](https://aistudio.google.com/)
   - Create a free API Key
   - Create a `.env` file in the root directory:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```

3. **Run the Application**:
   ```bash
   python app.py
   ```

4. **Open in Browser**:
   - Go to `http://localhost:8000`

## How it works
1. You upload a PDF invoice.
2. The backend extracts text using `pypdf`.
3. The text is sent to Gemini with a structured prompt.
4. Gemini returns a clean JSON object.
5. The UI populates the form with the extracted details.
