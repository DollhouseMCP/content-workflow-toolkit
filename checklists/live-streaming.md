# Live Streaming Checklist

Complete these steps before, during, and after a live stream.

## Pre-Stream Setup (Day Before)

### Content Prep
- [ ] Topic and outline finalized
- [ ] Talking points prepared (not full script - stay conversational)
- [ ] Any demos tested and working
- [ ] Code samples ready and accessible
- [ ] Pre-recorded videos/clips loaded in OBS
- [ ] Browser tabs pre-loaded and organized

### Technical Setup
- [ ] OBS scenes configured
  - [ ] Talking Head scene
  - [ ] Screen Share scene
  - [ ] Picture-in-Picture scene
  - [ ] Video Playback scene
  - [ ] BRB / Starting Soon scene
- [ ] Stream key entered (YouTube/Twitch)
- [ ] Hotkeys configured and tested
- [ ] Local recording enabled (ALWAYS record locally!)
- [ ] Overlays and graphics positioned

---

## Pre-Stream (30 Minutes Before)

### Hardware Check
- [ ] Camera on and framed correctly
- [ ] Microphone connected and selected
- [ ] Audio interface powered (if using)
- [ ] Headphones ready for monitoring
- [ ] Lighting on and consistent
- [ ] Backup batteries charged (if applicable)

### Software Check
- [ ] OBS running and sources active
- [ ] Audio levels tested (-12 to -6 dB peaks)
- [ ] Video preview looks correct
- [ ] Stream preview tested (YouTube Studio)
- [ ] All scenes switching correctly via hotkeys

### Environment
- [ ] Do Not Disturb enabled on ALL devices
- [ ] Phone silenced or in another room
- [ ] Notifications disabled (Slack, Discord, email)
- [ ] Background clean and presentable
- [ ] Water/drink nearby

### Stream Setup
- [ ] Title and description set on platform
- [ ] Thumbnail uploaded (if pre-made)
- [ ] Category/tags configured
- [ ] Chat moderation settings configured
- [ ] Waiting room/countdown active (if using)

---

## Go Live

### Start Sequence
- [ ] Start local recording FIRST
- [ ] Start stream
- [ ] Verify stream is live (check on phone/second device)
- [ ] Welcome viewers, wait for people to join
- [ ] Brief intro of what you'll cover

### During Stream

#### Scene Management
- **F1** - Talking Head (direct commentary)
- **F2** - Screen Share (demos, code)
- **F3** - Picture-in-Picture (explain while showing)
- **F4** - Video Playback (show pre-recorded content)
- **F5** - BRB (if stepping away)

#### Audio Tips
- [ ] Check audio periodically (viewers will tell you if issues)
- [ ] When playing video: duck video audio to -20dB
- [ ] Mute when not speaking during video playback (optional)
- [ ] Watch for audio clipping

#### Engagement
- [ ] Acknowledge chat messages/questions
- [ ] Periodic recap for new joiners
- [ ] Ask questions to encourage interaction
- [ ] Thank followers/subscribers

#### Pacing
- [ ] Take natural breaks between topics
- [ ] Summarize key points periodically
- [ ] Check time - stay on schedule
- [ ] If going long, let viewers know

---

## Playing Pre-Recorded Content

When showing videos during stream:

### Setup
- [ ] Video loaded as Media Source in OBS
- [ ] Video Playback scene configured with your mic
- [ ] Video audio set to -20dB (background level)
- [ ] Your mic at 0dB (foreground level)

### Flow
1. [ ] Introduce what you're about to show
2. [ ] Switch to Video Playback scene (F4)
3. [ ] Provide live commentary over the video
4. [ ] Switch back to Talking Head (F1)
5. [ ] Discuss/react to what was shown

---

## Ending Stream

### Wrap Up
- [ ] Summarize what was covered
- [ ] Thank viewers for watching
- [ ] Mention upcoming content/next stream
- [ ] Call to action (subscribe, like, follow)
- [ ] Say goodbye, wait a few seconds

### Technical
- [ ] End stream on platform
- [ ] Stop local recording
- [ ] Verify recording saved correctly
- [ ] Check recording file is playable

---

## Post-Stream

### Immediate
- [ ] Verify VOD is processing on platform
- [ ] Check local recording quality
- [ ] Note any technical issues for next time
- [ ] Respond to any lingering chat messages

### Content Repurposing
- [ ] Identify highlight clips (timestamps)
- [ ] Note sections that could be standalone videos
- [ ] Consider what worked/didn't for next stream

### Optional Editing
- [ ] Import VOD into editor
- [ ] Create highlight reel
- [ ] Extract clips for Shorts/TikTok
- [ ] Run transcribe.py on VOD for captions
- [ ] Upload edited version as separate video

---

## OBS Quick Reference

### Recommended Settings

```yaml
Output:
  mode: Advanced
  encoder: x264 or NVENC (GPU)
  rate_control: CBR
  bitrate: 6000 kbps  # Adjust for your upload
  keyframe_interval: 2

Video:
  base_resolution: 1920x1080
  output_resolution: 1920x1080
  fps: 30  # or 60 for fast content

Audio:
  sample_rate: 48 kHz
  channels: Stereo
```

### Hotkey Suggestions

| Action | Hotkey |
|--------|--------|
| Scene: Talking Head | F1 |
| Scene: Screen Share | F2 |
| Scene: PiP | F3 |
| Scene: Video Playback | F4 |
| Scene: BRB | F5 |
| Mute/Unmute Mic | F9 |
| Start Recording | F10 |
| Stop Recording | F11 |
| Start Streaming | Ctrl+F10 |
| Stop Streaming | Ctrl+F11 |

### Audio Levels

| Source | Level | Notes |
|--------|-------|-------|
| Microphone | -12 to -6 dB | Peaks, not average |
| Desktop Audio | -20 to -15 dB | Background level |
| Video Playback | -20 dB | When talking over |
| Alerts/Sounds | -15 dB | Not jarring |

---

## Troubleshooting

### No Audio
- [ ] Check audio source is selected in OBS
- [ ] Check audio interface is powered
- [ ] Check mic is not muted in mixer
- [ ] Check system audio settings

### Dropped Frames
- [ ] Lower bitrate (try 4500 kbps)
- [ ] Close background applications
- [ ] Check network stability
- [ ] Switch encoder (x264 ↔ NVENC)

### Video Issues
- [ ] Check camera is selected and not in use elsewhere
- [ ] Check resolution matches source
- [ ] Check frame rate isn't too high for system

### Stream Disconnects
- [ ] Check network connection
- [ ] Re-enter stream key
- [ ] Restart OBS
- [ ] Try wired connection instead of WiFi

---

**Stream Session Notes:**

Date:
Platform:
Duration:
Peak Viewers:
Technical Issues:
What Worked:
What to Improve:
