const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileNameDisplay = document.getElementById('file-name');
const extractBtn = document.getElementById('extract-btn');
const saveBtn = document.getElementById('save-btn');
const resultSection = document.getElementById('result-section');
const loader = document.getElementById('loader');
const contentGrid = document.getElementById('content-grid');
const itemsBody = document.getElementById('items-body');
const historyBody = document.getElementById('history-body');
const pdfViewer = document.getElementById('pdf-viewer');

let currentFile = null;

// Initial Load
(async function init() {
    console.log('InvoiceAI Initializing...');
    await loadHistory();
    if (window.lucide) lucide.createIcons();
})();

async function loadHistory() {
    console.log('Fetching history from /invoices...');
    try {
        const response = await fetch('/invoices');
        const invoices = await response.json();
        console.log('Invoices received:', invoices);

        historyBody.innerHTML = '';
        if (!invoices || invoices.length === 0) {
            historyBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No saved invoices yet</td></tr>';
            return;
        }

        // Sort by saved_at descending
        invoices.sort((a, b) => {
            const dateA = new Date(a.saved_at || 0);
            const dateB = new Date(b.saved_at || 0);
            return dateB - dateA;
        });

        invoices.forEach(inv => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${inv.saved_at || '-'}</td>
                <td>${inv.vendor_name || 'Unknown'}</td>
                <td>${inv.invoice_number || '-'}</td>
                <td>${inv.currency || ''} ${inv.total_amount || '0'}</td>
                <td>
                    <button class="btn-view" onclick="viewInvoiceDetails('${inv.id}')">View</button>
                    <button class="btn-delete" onclick="deleteInvoice('${inv.id}')">Delete</button>
                </td>
            `;
            historyBody.appendChild(row);
        });
    } catch (err) {
        console.error('Failed to load history:', err);
    }
}

// Global functions for buttons in table
window.viewInvoiceDetails = (id) => {
    fetch('/invoices').then(res => res.json()).then(invoices => {
        const inv = invoices.find(i => i.id === id);
        if (inv) alert('Invoice Details:\n' + JSON.stringify(inv, null, 2));
    });
};

window.deleteInvoice = async (id) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
        const response = await fetch(`/delete/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            console.log('Deleted:', id);
            await loadHistory();
        } else {
            alert('Error: ' + result.detail);
        }
    } catch (err) {
        console.error('Delete failed:', err);
    }
};

// File Selection Handler
function handleFileSelection(file) {
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isPDF = fileName.endsWith('.pdf');
    const isImage = /\.(png|jpg|jpeg|webp)$/.test(fileName);

    if (!isPDF && !isImage) {
        alert('Please select a valid PDF or Image file.');
        return;
    }

    currentFile = file;
    fileNameDisplay.textContent = `Selected: ${file.name}`;
    fileInfo.classList.remove('hidden');
    document.querySelector('.upload-content').classList.add('hidden');

    // Reset results UI
    resultSection.classList.add('hidden');
    contentGrid.classList.add('hidden');

    const fileURL = URL.createObjectURL(file);
    if (isPDF) {
        pdfViewer.innerHTML = `<iframe src="${fileURL}" width="100%" height="100%" style="border:none; border-radius: 12px;"></iframe>`;
    } else {
        pdfViewer.innerHTML = `<img src="${fileURL}" style="max-width: 100%; max-height: 100%; border-radius: 12px; object-fit: contain;">`;
    }
}

// Event Listeners
if (dropZone) {
    dropZone.onclick = (e) => {
        if (e.target.tagName !== 'BUTTON') fileInput.click();
    };
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drag-active'); };
    dropZone.ondragleave = () => dropZone.classList.remove('drag-active');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        if (e.dataTransfer.files.length > 0) handleFileSelection(e.dataTransfer.files[0]);
    };
}

if (fileInput) {
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
    };
}

// Extraction Logic
if (extractBtn) {
    extractBtn.onclick = async () => {
        if (!currentFile) return;

        resultSection.classList.remove('hidden');
        loader.classList.remove('hidden');
        contentGrid.classList.add('hidden');

        resultSection.scrollIntoView({ behavior: 'smooth' });

        const formData = new FormData();
        formData.append('file', currentFile);

        try {
            const response = await fetch('/extract', { method: 'POST', body: formData });
            if (!response.ok) throw new Error(await response.text());

            const data = await response.json();

            // Fill form
            document.getElementById('vendor_name').value = data.vendor_name || '';
            document.getElementById('invoice_number').value = data.invoice_number || '';
            document.getElementById('date').value = data.date || '';
            document.getElementById('total_amount').value = data.total_amount || '';
            document.getElementById('currency').value = data.currency || '';

            // Fill items
            itemsBody.innerHTML = '';
            const items = data.items || [];
            if (items.length > 0) {
                items.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.description || '-'}</td>
                        <td>${item.quantity || '-'}</td>
                        <td>${item.unit_price || '-'}</td>
                        <td>${item.total_price || '-'}</td>
                    `;
                    itemsBody.appendChild(tr);
                });
            } else {
                itemsBody.innerHTML = '<tr><td colspan="4" style="text-align:center">No items found</td></tr>';
            }

            loader.classList.add('hidden');
            contentGrid.classList.remove('hidden');
        } catch (error) {
            console.error(error);
            alert('Extraction error. Please check your API key and file.');
            loader.classList.add('hidden');
        }
    };
}

// Save Logic
if (saveBtn) {
    saveBtn.onclick = async () => {
        console.log('Save button clicked!');

        const data = {
            vendor_name: document.getElementById('vendor_name').value,
            invoice_number: document.getElementById('invoice_number').value,
            date: document.getElementById('date').value,
            total_amount: document.getElementById('total_amount').value,
            currency: document.getElementById('currency').value,
            saved_at: new Date().toLocaleString(),
            items: []
        };

        const rows = itemsBody.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length === 4 && cells[0].textContent !== 'No items found') {
                data.items.push({
                    description: cells[0].textContent,
                    quantity: cells[1].textContent,
                    unit_price: cells[2].textContent,
                    total_price: cells[3].textContent
                });
            }
        });

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const response = await fetch('/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                const res = await response.json();
                console.log('Saved successfully');
                await loadHistory();

                // Success: reset view and show history
                resultSection.classList.add('hidden');
                document.querySelector('.upload-content').classList.remove('hidden');
                fileInfo.classList.add('hidden');
                document.getElementById('history-section').scrollIntoView({ behavior: 'smooth' });
                alert('✅ Invoice Saved Successfully!');
            } else {
                throw new Error('Server returned error');
            }
        } catch (error) {
            alert('❌ Failed to save. Check terminal logs.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Confirm & Save';
        }
    };
}
