# Distribution Checklist

Complete these steps for publishing and multi-platform promotion.

## YouTube Upload

### Upload
- [ ] Log into YouTube Studio
- [ ] Upload video file
- [ ] Set visibility (private initially, then scheduled/public)

### Metadata
- [ ] Title: Compelling, includes keywords, under 60 chars
- [ ] Description: First 2-3 lines hook, then full description
- [ ] Tags: Primary keywords + long-tail variations
- [ ] Custom thumbnail uploaded
- [ ] Category set (Science & Tech)
- [ ] Captions uploaded (.srt file)

### Settings
- [ ] Add to appropriate playlist(s)
- [ ] Set age restriction (if needed)
- [ ] Enable/disable comments
- [ ] Set video location (if relevant)
- [ ] Add end screen (last 20 seconds)
- [ ] Add cards (links to related content)

### Chapters
- [ ] Add timestamps to description
- [ ] Verify chapters appear in player
- [ ] Chapters have descriptive names

---

## After Publish (Same Day)

### Immediate (first hour)
- [ ] Verify video is live/scheduled correctly
- [ ] Watch first minute to check quality
- [ ] Respond to any early comments
- [ ] Copy video link for sharing

### Social Media Posts

Use Claude to help draft posts from your transcript/video.

#### LinkedIn
- [ ] Draft post using `templates/social-posts-template.md`
- [ ] Professional tone, focus on key insight
- [ ] Add link in first comment (better for algorithm)
- [ ] Include relevant hashtags
- [ ] Post during business hours (Tue-Thu, 8-10am or 12-1pm)

#### Blue Sky
- [ ] Draft short post (300 char limit)
- [ ] Include hook + link
- [ ] Add relevant hashtags (#MCP, #AI, #Developer)
- [ ] Conversational, authentic tone

#### Mastodon
- [ ] Draft post (500 char limit)
- [ ] Include clear description + link
- [ ] Add hashtags (discovery depends on them)
- [ ] Tech-focused tone

#### Discord/Communities
- [ ] Share in relevant Discord servers
- [ ] Post in appropriate channels
- [ ] Add context, not just link drop

> ❌ **Skip Twitter/X** - Deliberately excluded from this workflow.

---

## Content Repurposing

### Blog Post (Day 1-2)
- [ ] Use transcript as starting point
- [ ] Ask Claude to expand into blog post format
- [ ] Add code samples, screenshots, details
- [ ] Use `templates/blog-post-template.md`
- [ ] Include YouTube embed or link
- [ ] Publish to your blog platform
- [ ] Share blog link on social media

### YouTube Shorts (Day 1-3)
- [ ] Review video for 30-60 second highlights
- [ ] Extract vertical clip (9:16 ratio)
- [ ] Add captions to Short
- [ ] Upload as Short
- [ ] Write short description with #Shorts
- [ ] Link to full video in description

### Additional Repurposing (Optional)
- [ ] Extract audio for podcast (if applicable)
- [ ] Create social media graphics from key frames
- [ ] Write a thread-style breakdown for Blue Sky/Mastodon

---

## AI-Assisted Content Creation

### Prompt Template
```
Here's my video transcript about [topic]:

[Paste transcript]

Please help me create:
1. A blog post that expands on the key points with code examples
2. A LinkedIn post (professional, key insight, link in comments note)
3. A Blue Sky post (casual, 300 chars max)
4. A Mastodon post (500 chars, include hashtags)
```

### Review Before Posting
- [ ] Check AI drafts for accuracy
- [ ] Add your personal voice/edits
- [ ] Verify links are correct
- [ ] Confirm hashtags are appropriate

---

## Platform Quick Reference

| Platform | Format | Post With |
|----------|--------|-----------|
| **YouTube** | Full video | Description, thumbnail, captions |
| **YouTube Shorts** | 30-60s vertical | Short description, #Shorts |
| **LinkedIn** | Text + link in comment | Professional tone, hashtags |
| **Blue Sky** | Text + link | Casual, 300 chars |
| **Mastodon** | Text + link | Tech-focused, hashtags, 500 chars |
| **Blog** | Full article | Code samples, YouTube embed |

---

## Community Engagement

### Day 1-2
- [ ] Respond to all YouTube comments
- [ ] Pin best comment or FAQ answer
- [ ] Respond to social media comments
- [ ] Answer questions thoroughly

### Week 1
- [ ] Check YouTube analytics (CTR, retention)
- [ ] Note what's working/not working
- [ ] Engage with new subscribers
- [ ] Track social media engagement

---

## Analytics Tracking

### Record in metadata.yml
- [ ] YouTube video ID
- [ ] Publish date
- [ ] 24-hour views
- [ ] 7-day views
- [ ] Click-through rate (CTR)
- [ ] Average view duration
- [ ] Top traffic sources

### Track Social Performance
- [ ] LinkedIn: impressions, engagement
- [ ] Blue Sky: likes, reposts
- [ ] Mastodon: boosts, favorites
- [ ] Blog: page views (if available)

### Review & Learn
- [ ] What was the hook retention?
- [ ] Where did viewers drop off?
- [ ] What comments are common?
- [ ] Which platform performed best?
- [ ] What would you do differently?

---

## Archive & Document

- [ ] Update episode `metadata.yml` with analytics
- [ ] Add any learnings to notes.md
- [ ] Link video in relevant project repos
- [ ] Save social post drafts to episode folder
- [ ] Commit all files to git
- [ ] Mark episode as complete

---

## Cross-Posting Schedule

| When | Platform | Content |
|------|----------|---------|
| **Day 0** | YouTube | Video publishes |
| **Day 0** | LinkedIn | Announcement post |
| **Day 0** | Blue Sky | Quick share |
| **Day 0** | Mastodon | Quick share |
| **Day 1-2** | Blog | Full article |
| **Day 1-3** | YouTube Shorts | Highlight clips |
| **Week 1** | All | Engagement & follow-up |

---

**Distribution Notes:**

Episode:
Published:
Platforms shared:
Blog URL:
Shorts created:
Initial response:
Learnings:
