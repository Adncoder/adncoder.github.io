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
