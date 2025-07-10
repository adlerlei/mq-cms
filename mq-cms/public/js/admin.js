document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('fileInput');
    const fileName = document.getElementById('fileName');

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                fileName.textContent = fileInput.files[0].name;
            } else {
                fileName.textContent = 'No file selected';
            }
        });
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const file = fileInput.files[0];
            if (!file) {
                alert('Please select a file to upload.');
                return;
            }

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/api/media', {
                    method: 'POST',
                    body: formData,
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('Upload successful:', result);
                    alert(`File uploaded successfully. Key: ${result.key}`);
                    fileName.textContent = 'No file selected';
                    uploadForm.reset();
                } else {
                    const error = await response.json();
                    console.error('Upload failed:', error);
                    alert(`Upload failed: ${error.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error uploading file:', error);
                alert('An error occurred while uploading the file.');
            }
        });
    }
});