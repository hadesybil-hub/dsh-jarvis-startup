"""Generate personal speech locally from online TTS; generated recordings are not committed."""
import argparse, asyncio, subprocess
from pathlib import Path
import edge_tts
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--spoken-name', default='Commander')
parser.add_argument('--voice', default='en-US-AndrewNeural')
parser.add_argument('--proxy', default=None, help='Optional proxy for this invocation; system settings are not changed')
args = parser.parse_args()
state = ROOT / '.local-state'
state.mkdir(exist_ok=True)
filter_chain = ('aformat=sample_rates=48000:channel_layouts=stereo,'
                'highpass=f=90,lowpass=f=11000,'
                'acompressor=threshold=0.15:ratio=2:attack=12:release=150,'
                'aecho=0.8:0.88:62|130|230:0.16|0.10|0.06,'
                'loudnorm=I=-18:TP=-2:LRA=7')
lines = {
    '1': 'Neural core is coming online.',
    '2': f'Welcome, {args.spoken_name}. Your personal interface is ready.',
    '3': 'Synchronizing your command interface.',
    '4': 'Your workspace is standing by.',
    '5': 'All systems are ready.',
    '6': f'Welcome back, {args.spoken_name}. Jarvis is online, and ready when you are.',
    'ready': f'Welcome back, {args.spoken_name}.',
}
async def main():
    for slot, text in lines.items():
        raw = state / f'speech-{slot}.mp3'
        await edge_tts.Communicate(text, voice=args.voice, rate='-3%', pitch='-3Hz', proxy=args.proxy).save(str(raw))
        output = ROOT / f'voice-us-{slot}.mp3'
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-y',
                        '-i', str(raw), '-af', filter_chain, '-ar', '48000', '-ac', '2',
                        '-c:a', 'libmp3lame', '-b:a', '160k', str(output)], check=True)
        print(f'Generated {output.name}')
asyncio.run(main())
