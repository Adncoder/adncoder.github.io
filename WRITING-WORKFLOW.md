# Writing and publishing

Write freely in Obsidian notebooks. When a piece deserves its own file, use the writing template and keep it in Essays, Fiction, or Poetry. Notebooks and the Writing Dashboard stay in the vault.

`status` describes the work's stage (`draft`, `finished`, `submission-ready`, or `published`). `publish: true` independently selects a work for this website. A note must also have `type: writing` to be copied. Changing status alone does not publish it.

Use `written` for the original writing date and `date` for the website publication date. The website's automatic lists sort by `date`. Use `genre: poetry` to preserve line and stanza breaks. A description is optional; when supplied, it appears in the writing list.

1. Finish editing in Obsidian and save the note.
2. Set `publish: true` when the complete note is ready to be public.
3. Run **PREVIEW SITE.bat** and check the work at http://localhost:8080.
4. Run **PUBLISH SITE.bat**, review the changed files, and type `PUBLISH`.

The homepage and Writing page populate automatically from published works. No manual links need to be maintained. Edit the writing in Obsidian, because the public copy is overwritten on the next sync.

Setting `publish: false` removes the script-managed website copy on the next sync and removes it from the automatic lists on the next build. Publish again to update the live website. This does not erase earlier public Git history.

## Current limitations

- Attachments are not copied automatically. Review warnings about images and Obsidian links; only links to public notes can work on the website.
- The sync script filters frontmatter properties but copies the complete note body, including comments and any drafting notes. Keep the selected work's body ready for publication.
- The current PowerShell filter expects unquoted `type: writing` and `publish: true`. Use those exact property values with the existing template.
- Preview syncs into the website folder; it does not push to GitHub. Publishing reviews all repository changes, including any site edits, before committing them.
- The Obsidian source path remains in scripts/publish-writing.ps1. If the vault moves, update that path.

GitHub Pages remains the hosting destination. The writing notebooks, workflow statuses, and source notes are not altered by the website design.

## All-Time Favorites

Edit `Andrew/Life/Watch & Reading List/All-Time Favorites.md` in Obsidian.
This is a separate `type: collection` note, so it does not enter the writing lists.
It starts with `publish: false`. Complete the entries and set `publish: true` when ready.
Both existing shortcuts sync this one note in addition to your selected writing.
The public page is `/favorites`; the Favorites navigation link appears only when the page is published.

The note contains Books, Songs, Games, Movies, Art, and Other Media sections.
Duplicate an entry to add a favorite, and delete categories you are not ready to share.
Book quotations use ordinary Markdown blockquotes, with your own reflection beneath.
Paste an official Spotify/YouTube embed for a song or gameplay clip. YouTube embeds
can use `start` and `end` parameters in seconds; players do not autoplay by default.
Music-provider playback and excerpt availability depend on that provider.
For art, use a hosted image with descriptive alt text and a source credit/link.
Audio clips dragged into this note are copied automatically. Local images and other
attachments still need hosted URLs.

### Adding a favorite audio moment

1. Prepare a short MP3 of the passage you want readers to hear. In Audacity, select
   the passage and export the current selection as MP3. Give it a recognizable,
   unique name such as `reverie-favorite.mp3`.
2. Open All-Time Favorites in Obsidian's editing view and drag the file from File
   Explorer onto a blank line beneath the song title. Obsidian copies it into your
   configured attachment folder and inserts `![[reverie-favorite.mp3]]`.
3. Run PREVIEW SITE.bat, check `/favorites`, then run PUBLISH SITE.bat as usual.
   No HTML or manual copy into the website repository is needed.

The publisher supports MP3, M4A, WAV, OGG, FLAC, AAC and WebM audio, up to 25 MB per
file; MP3 is the simplest choice for short clips. It copies the entire attached
file, so trim the file first if you only want to share an excerpt. Only referenced
audio outside private comments and code examples is exported. It accepts Obsidian
audio embeds and Markdown attachment embeds, resolving files beside the note, at
the vault root, or in Obsidian's configured attachment folder. For other locations
use the full vault-relative path. Missing or ambiguous files stop publication.

Removing an audio embed or turning publish off removes its managed website audio
copy on the next sync. It does not delete the Obsidian attachment or earlier Git
history. Preview must be restarted after editing the note or replacing a clip.

Obsidian comments and HTML comments are removed before the note enters the public
repository. All other body content becomes public. Private media databases are not
scanned or exported. Turning `publish` off removes the managed favorites page and audio
on the next sync; run Publish to update the live site. Missing source notes, unfinished
comments, and conflicts with manually created website files stop the sync.
