# Soundboard Sound Files

This directory should contain the audio files for the soundboard feature.

## Required Sound Files

Add the following `.mp3` files to this directory:

| File Name | Sound Effect | Category | Duration |
|-----------|-------------|----------|----------|
| `airhorn.mp3` | Airhorn | Reaction | ~2s |
| `applause.mp3` | Applause/Clapping | Reaction | ~3.5s |
| `cheering.mp3` | Crowd Cheering | Reaction | ~3s |
| `golf-clap.mp3` | Golf Clap | Reaction | ~2.5s |
| `wow.mp3` | Owen Wilson "Wow" | Reaction | ~1.5s |
| `ba-dum-tss.mp3` | Rimshot (Ba Dum Tss) | Comedy | ~1.5s |
| `crickets.mp3` | Crickets | Comedy | ~3s |
| `sad-trombone.mp3` | Sad Trombone | Comedy | ~2s |
| `laugh-track.mp3` | Sitcom Laugh Track | Comedy | ~3.5s |
| `boo.mp3` | Crowd Booing | Comedy | ~2.5s |
| `quack.mp3` | Duck Quack | Effect | ~0.5s |
| `police-siren.mp3` | Police Siren | Effect | ~2.5s |
| `ding.mp3` | Bell Ding | Effect | ~1s |
| `explosion.mp3` | Explosion | Effect | ~2s |
| `mlg-horn.mp3` | MLG Airhorn | Meme | ~3s |
| `bruh.mp3` | Bruh | Meme | ~1s |
| `vine-boom.mp3` | Vine Boom | Meme | ~1.5s |
| `sus.mp3` | Among Us Sus | Meme | ~2s |

## Where to Get Sound Files

You can source royalty-free sound effects from:

1. **Freesound** - https://freesound.org (Free, requires attribution for some)
2. **Pixabay** - https://pixabay.com/sound-effects (Free, no attribution required)
3. **Mixkit** - https://mixkit.co/free-sound-effects (Free)
4. **Zapsplat** - https://www.zapsplat.com (Free with attribution)

## Audio Specifications

For optimal performance:

- **Format**: MP3
- **Sample Rate**: 44.1 kHz
- **Bitrate**: 128-192 kbps
- **Duration**: Keep files short (0.5s - 4s)
- **Volume**: Normalize to -3dB to -6dB

## Adding Custom Sounds

To add new sounds:

1. Add the `.mp3` file to this directory
2. Update `utils/soundboard/sounds.ts` with the new sound definition
3. The sound will automatically appear in the soundboard UI

## Example Sound Definition

```typescript
{
  id: 'my-sound',
  name: 'My Sound',
  emoji: '🎵',
  file: '/sounds/my-sound.mp3',
  category: 'effect',
  duration: 2000, // in milliseconds
  description: 'A cool sound effect',
  available: true,
}
```

