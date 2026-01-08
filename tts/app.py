"""
QuickYap TTS API - Piper Text-to-Speech Service

Provides REST endpoints for text-to-speech synthesis using Piper TTS.
"""

import os
import io
import wave
from pathlib import Path
from flask import Flask, request, jsonify, send_file, Response

app = Flask(__name__)

# Configuration
MODELS_PATH = Path(os.environ.get('PIPER_MODELS_PATH', '/models'))

# Cache for loaded voices
_voice_cache = {}


def get_available_voices():
    """Scan models directory for available voice files."""
    voices = []
    if MODELS_PATH.exists():
        for onnx_file in MODELS_PATH.glob('*.onnx'):
            voice_name = onnx_file.stem
            json_file = onnx_file.with_suffix('.onnx.json')
            if json_file.exists():
                voices.append(voice_name)
    return sorted(voices)


def get_voice(voice_name):
    """Load or retrieve cached Piper voice."""
    if voice_name in _voice_cache:
        return _voice_cache[voice_name]
    
    onnx_path = MODELS_PATH / f"{voice_name}.onnx"
    json_path = MODELS_PATH / f"{voice_name}.onnx.json"
    
    if not onnx_path.exists() or not json_path.exists():
        return None
    
    try:
        from piper import PiperVoice
        voice = PiperVoice.load(str(onnx_path), config_path=str(json_path))
        _voice_cache[voice_name] = voice
        return voice
    except Exception as e:
        app.logger.error(f"Failed to load voice {voice_name}: {e}")
        return None


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'voices_available': len(get_available_voices())
    })


@app.route('/voices', methods=['GET'])
def list_voices():
    """List available voices."""
    voices = get_available_voices()
    return jsonify(voices)


@app.route('/synthesize/<voice>', methods=['GET', 'POST'])
def synthesize(voice):
    """
    Synthesize text to speech.
    
    Query Parameters:
        text: Text to synthesize (GET) or in request body (POST)
        length_scale: Speaking rate (default: 1.0, higher = slower)
    
    Returns:
        audio/wav file
    """
    # Get text from query params or body
    if request.method == 'POST':
        if request.is_json:
            data = request.get_json()
            text = data.get('text', '')
        else:
            text = request.form.get('text', '') or request.data.decode('utf-8')
    else:
        text = request.args.get('text', '')
    
    if not text:
        return jsonify({'error': 'No text provided'}), 400
    
    # Get length_scale (speaking rate)
    try:
        length_scale = float(request.args.get('length_scale', 1.0))
        length_scale = max(0.5, min(2.0, length_scale))  # Clamp to reasonable range
    except ValueError:
        length_scale = 1.0
    
    # Load voice
    piper_voice = get_voice(voice)
    if piper_voice is None:
        return jsonify({'error': f'Voice not found: {voice}'}), 404
    
    try:
        # Synthesize audio
        audio_buffer = io.BytesIO()
        
        with wave.open(audio_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(piper_voice.config.sample_rate)
            
            for audio_bytes in piper_voice.synthesize_stream_raw(
                text,
                length_scale=length_scale
            ):
                wav_file.writeframes(audio_bytes)
        
        audio_buffer.seek(0)
        
        return send_file(
            audio_buffer,
            mimetype='audio/wav',
            as_attachment=False,
            download_name=f'{voice}.wav'
        )
        
    except Exception as e:
        app.logger.error(f"Synthesis error: {e}")
        return jsonify({'error': f'Synthesis failed: {str(e)}'}), 500


@app.route('/', methods=['GET'])
def index():
    """API info."""
    return jsonify({
        'name': 'QuickYap TTS API',
        'version': '1.0.0',
        'endpoints': {
            '/health': 'Health check',
            '/voices': 'List available voices',
            '/synthesize/<voice>': 'Synthesize text to speech'
        }
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
