# Remote Interview Checklist

Complete these steps for recording guest interviews via Zoom, Jitsi (Zulip), or other video conferencing.

## Pre-Interview (Day Before)

### Guest Coordination
- [ ] Confirm date/time with guest (include timezone!)
- [ ] Send calendar invite with video link
- [ ] Share topic outline/talking points
- [ ] Request they use headphones (prevents echo)
- [ ] Ask about their recording setup (backup options)
- [ ] Confirm pronunciation of their name/title

### Technical Prep
- [ ] Test video conference platform
- [ ] Configure OBS for interview recording
  - [ ] Window capture source for conference app
  - [ ] Your camera as separate source
  - [ ] Your mic as direct input
  - [ ] Desktop audio for guest's voice
- [ ] Create/verify interview scenes:
  - [ ] Side-by-side (50/50)
  - [ ] Guest focus (guest large, you PiP)
  - [ ] Host focus (you large, guest PiP)
  - [ ] Screen share view
- [ ] Test hotkeys for scene switching

### Content Prep
- [ ] Outline of topics/questions prepared
- [ ] Research on guest's background
- [ ] Any demos or content to screen share ready
- [ ] Introduction script drafted

---

## Pre-Interview (30 Minutes Before)

### Environment
- [ ] Quiet space secured
- [ ] Do Not Disturb on all devices
- [ ] Background clean and presentable
- [ ] Lighting consistent
- [ ] Water nearby

### Technical Check
- [ ] OBS running and configured
- [ ] Video conference app ready
- [ ] Camera on and framed
- [ ] Microphone tested
- [ ] Audio levels set (-12 to -6 dB peaks)
- [ ] Headphones connected (to hear guest clearly)
- [ ] Test call completed (if first time with platform)

### Recording Prep
- [ ] OBS recording destination has space
- [ ] Platform recording enabled (backup)
- [ ] Scene hotkeys memorized:
  - F1: Side-by-Side
  - F2: Guest Focus
  - F3: Host Focus
  - F4: Screen Share

---

## Interview Start

### Pre-Roll
- [ ] Join call 5 minutes early
- [ ] Greet guest, small talk
- [ ] Confirm they can hear/see you clearly
- [ ] Ask about their audio setup (headphones?)
- [ ] Brief overview of how it will go

### Recording Start
- [ ] Start OBS recording FIRST
- [ ] Start platform recording (backup)
- [ ] Announce: "I'm recording now, is that okay?"
- [ ] Wait for verbal consent

### Opening
- [ ] Introduce yourself
- [ ] Introduce the guest (name, title, why they're here)
- [ ] Preview what you'll discuss

---

## During Interview

### Scene Management
| Situation | Scene | Hotkey |
|-----------|-------|--------|
| Normal conversation | Side-by-Side | F1 |
| Guest is explaining | Guest Focus | F2 |
| You're explaining | Host Focus | F3 |
| Showing content | Screen Share | F4 |

### Best Practices
- [ ] Make eye contact with camera (not screen)
- [ ] Nod and react visibly (shows you're listening)
- [ ] Let guest finish before speaking
- [ ] Ask follow-up questions
- [ ] Manage time - keep topics moving
- [ ] Note interesting moments for highlights

### If Technical Issues
- [ ] Stay calm
- [ ] Ask guest: "Can you still hear me?"
- [ ] Check if recording is still running
- [ ] Suggest reconnecting if needed
- [ ] Platform recording serves as backup

### Screen Sharing
- [ ] Announce before sharing: "Let me share my screen"
- [ ] Switch to Screen Share scene (F4)
- [ ] Make content large enough to see
- [ ] Switch back when done

---

## Ending Interview

### Wrap Up
- [ ] Summarize key points discussed
- [ ] Ask guest for final thoughts
- [ ] Thank them for their time
- [ ] Mention where/when content will be published
- [ ] Ask for their preferred links to include (social, website)

### Recording Stop
- [ ] Announce: "I'm going to stop the recording"
- [ ] Stop OBS recording
- [ ] Stop platform recording
- [ ] Verify both recordings saved

### Post-Call
- [ ] Thank guest again (off-recording)
- [ ] Confirm timeline for publishing
- [ ] Offer to send preview before publish (if applicable)
- [ ] Say goodbye

---

## Post-Interview

### Immediate
- [ ] Verify OBS recording is playable
- [ ] Download platform recording (backup)
- [ ] Backup all recordings to safe location

### File Organization
```
interview-episode/
├── raw/
│   └── interview/
│       ├── obs-combined.mkv      # Primary recording
│       ├── zoom-backup.mp4       # Platform backup
│       └── guest-local.mp4       # If guest sent theirs
├── audio/
│   └── guest-audio.wav           # If extracted separately
└── notes.md                      # Interview notes, timestamps
```

### Follow Up
- [ ] Send thank you email to guest
- [ ] Request guest's local recording (if they recorded)
- [ ] Share any assets they mentioned
- [ ] Note interesting quotes/moments for highlights

### Editing Notes
Document these for post-production:
- [ ] Great quotes (timestamps)
- [ ] Moments to highlight
- [ ] Sections to cut (technical issues, tangents)
- [ ] Key topics for chapters

---

## OBS Quick Reference

### Interview Scenes Setup

| Scene | Sources | Layout |
|-------|---------|--------|
| Side-by-Side | Window capture, your cam | 50/50 split |
| Guest Focus | Window capture cropped, your cam small | Guest 80%, you 20% |
| Host Focus | Your cam large, window capture small | You 80%, guest 20% |
| Screen Share | Display capture, participants small | Screen 80%, faces 20% |

### Audio Configuration

| Source | Level | Notes |
|--------|-------|-------|
| Your Mic | -12 to -6 dB | Direct input, not conference |
| Desktop Audio | -12 to -6 dB | Captures guest voice |
| System Sounds | Muted | Prevent notification sounds |

### Hotkey Setup

| Action | Suggested Key |
|--------|---------------|
| Scene: Side-by-Side | F1 |
| Scene: Guest Focus | F2 |
| Scene: Host Focus | F3 |
| Scene: Screen Share | F4 |
| Mute/Unmute Mic | F9 |
| Start Recording | F10 |
| Stop Recording | F11 |

---

## Troubleshooting

### Guest Audio Issues
- [ ] Ask them to check mic selection in conference app
- [ ] Suggest they rejoin the call
- [ ] Check your desktop audio capture in OBS
- [ ] Switch to phone audio as backup

### Guest Video Issues
- [ ] Ask them to check camera selection
- [ ] Suggest turning video off/on
- [ ] Lower their video quality if bandwidth issues
- [ ] Continue audio-only if necessary

### Your Connection Issues
- [ ] Switch to wired ethernet if on WiFi
- [ ] Close bandwidth-heavy applications
- [ ] Lower your video quality
- [ ] Restart router if severe

### OBS Not Capturing Conference Window
- [ ] Re-select window capture source
- [ ] Try display capture instead
- [ ] Restart OBS
- [ ] Check if conference app is blocking capture

---

**Interview Session Notes:**

Guest Name:
Date:
Platform:
Duration:
Topics Covered:
Technical Issues:
Best Moments (timestamps):
Follow-up Items:
