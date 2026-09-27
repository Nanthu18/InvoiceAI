import os
import io
import json
import google.generativeai as genai
from pypdf import PdfReader
from typing import Dict, Any

class InvoiceExtractor:
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-flash-latest')

    def extract_text_from_pdf(self, pdf_file) -> str:
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text()
        return text

    async def extract_details(self, file_content: bytes, is_pdf: bool = True, mime_type: str = "application/pdf") -> Dict[str, Any]:
        try:
            if is_pdf:
                print("Processing PDF...")
                text = self.extract_text_from_pdf(io.BytesIO(file_content))
                prompt = f"""
                Extract the following details from this invoice text and return them in a JSON format.
                If a field is not found, return null.
                
                Fields to extract:
                - vendor_name
                - invoice_number
                - date
                - total_amount
                - currency
                - items (list of objects with: description, quantity, unit_price, total_price)
                - tax_amount
                
                Invoice Text:
                {text}
                
                Return ONLY the JSON.
                """
                response = self.model.generate_content(prompt)
            else:
                print(f"Processing Image ({mime_type}) using Gemini Vision...")
                prompt = """
                Look at this invoice image and extract the following details into a JSON format.
                If a field is not found, return null.
                
                Fields to extract:
                - vendor_name
                - invoice_number
                - date
                - total_amount
                - currency
                - items (list of objects with: description, quantity, unit_price, total_price)
                - tax_amount
                
                Return ONLY the JSON.
                """
                # For images, we send a list with the prompt and the image data
                response = self.model.generate_content([
                    prompt,
                    {
                        "mime_type": mime_type,
                        "data": file_content
                    }
                ])
            
            # Clean and parse the response
            content = response.text.strip()
            if "```" in content:
                # Remove markdown code blocks if the AI added them
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                else:
                    content = content.split("```")[1].split("```")[0].strip()
            
            return json.loads(content)
        except Exception as e:
            print(f"Extraction Error: {str(e)}")
            return {"error": f"Failed to extract info: {str(e)}"}
