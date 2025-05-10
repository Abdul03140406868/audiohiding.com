// DOM Elements
const imageInput = document.getElementById('imageInput');
const audioInput = document.getElementById('audioInput');
const encodeBtn = document.getElementById('encodeBtn');
const encodeStatus = document.getElementById('encodeStatus');
const scannedImage = document.getElementById('scannedImage');
const decodeBtn = document.getElementById('decodeBtn');
const decodeStatus = document.getElementById('decodeStatus');
const resultDiv = document.getElementById('result');

// File signature for our custom format
const SIGNATURE = "AUDIOHIDER";

// DOM Elements (same as before)

// Encode audio into image (IMPROVED)
encodeBtn.addEventListener('click', async () => {
    if (!imageInput.files[0] || !audioInput.files[0]) {
        showStatus(encodeStatus, "Please select both an image and an audio file", "error");
        return;
    }

    encodeBtn.disabled = true;
    encodeBtn.textContent = "Encoding...";
    
    try {
        const [imageFile, audioFile] = [imageInput.files[0], audioInput.files[0]];
        
        // Convert files to Data URLs
        const [imageUrl, audioUrl] = await Promise.all([
            readFileAsDataURL(imageFile),
            readFileAsDataURL(audioFile)
        ]);
        
        // Create a canvas to draw the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        await new Promise((resolve) => {
            img.onload = resolve;
            img.src = imageUrl;
        });
        
        // Set canvas dimensions
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Hide audio in the image (using steganography)
        const audioData = audioUrl.split(',')[1]; // Remove data URL prefix
        hideDataInImage(canvas, audioData);
        
        // Convert to PNG and download
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `hidden_audio_${Date.now()}.png`;
            a.click();
            showStatus(encodeStatus, "Success! Image with hidden audio downloaded", "success");
        }, 'image/png');
        
    } catch (error) {
        console.error("Encoding error:", error);
        showStatus(encodeStatus, "Error encoding audio into image", "error");
    } finally {
        encodeBtn.disabled = false;
        encodeBtn.textContent = "Encode & Download";
    }
});

// Decode audio from image (IMPROVED)
decodeBtn.addEventListener('click', async () => {
    if (!scannedImage.files[0]) {
        showStatus(decodeStatus, "Please select an image to scan", "error");
        return;
    }

    decodeBtn.disabled = true;
    decodeBtn.textContent = "Scanning...";
    resultDiv.innerHTML = "";
    
    try {
        const imageUrl = await readFileAsDataURL(scannedImage.files[0]);
        const img = new Image();
        
        await new Promise((resolve) => {
            img.onload = resolve;
            img.src = imageUrl;
        });
        
        // Create canvas to extract data
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Extract hidden audio
        const audioData = extractDataFromImage(canvas);
        if (!audioData) {
            showStatus(decodeStatus, "No hidden audio found in this image", "error");
            return;
        }
        
        // Create audio player
        const audioBlob = dataURLtoBlob(`data:audio/mp3;base64,${audioData}`);
        const audioUrl = URL.createObjectURL(audioBlob);
        
        resultDiv.innerHTML = `
            <p>Found hidden audio!</p>
            <audio controls autoplay>
                <source src="${audioUrl}" type="audio/mp3">
                Your browser does not support audio playback.
            </audio>
        `;
        
        showStatus(decodeStatus, "Audio extracted successfully!", "success");
    } catch (error) {
        console.error("Decoding error:", error);
        showStatus(decodeStatus, "Error extracting audio from image", "error");
    } finally {
        decodeBtn.disabled = false;
        decodeBtn.textContent = "Scan Image";
    }
});

// Steganography functions
function hideDataInImage(canvas, data) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // Convert data to binary string
    let binaryData = '';
    for (let i = 0; i < data.length; i++) {
        binaryData += data.charCodeAt(i).toString(2).padStart(8, '0');
    }
    
    // Add end marker
    binaryData += '00000000'; // Null terminator
    
    // Hide data in LSB of red channel
    let dataIndex = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        if (dataIndex < binaryData.length) {
            // Replace LSB with our data bit
            pixels[i] = (pixels[i] & 0xFE) | parseInt(binaryData[dataIndex]);
            dataIndex++;
        } else {
            break;
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}

function extractDataFromImage(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    let binaryData = '';
    let extractedByte = '';
    
    // Extract LSB from red channel
    for (let i = 0; i < pixels.length; i += 4) {
        const lsb = pixels[i] & 1;
        extractedByte += lsb;
        
        if (extractedByte.length === 8) {
            if (extractedByte === '00000000') break; // End marker
            
            const charCode = parseInt(extractedByte, 2);
            binaryData += String.fromCharCode(charCode);
            extractedByte = '';
        }
    }
    
    return binaryData || null;
}

// Helper functions
function readFileAsDataURL(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

function dataURLtoBlob(dataURL) {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status ${type}`;
    element.classList.remove("hidden");
    setTimeout(() => {
        element.classList.add("hidden");
    }, 5000);
}