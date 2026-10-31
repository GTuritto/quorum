# Article visuals

Three finished assets are embedded in `../introducing-quorum.md`.

| Asset | Placement | Format |
| --- | --- | --- |
| `quorum-cover.png` | Below the article title | AI-generated editorial illustration |
| `quorum-skill-architecture.png` | After the origin story's service-to-skill explanation | 1600 × 1000 PNG; editable SVG supplied |
| `quorum-full-review.png` | After the explanation of independent review | 1600 × 1130 PNG; editable SVG supplied |

For Medium, upload the PNG files at those positions. Copy the adjacent captions and image alt text from the Markdown draft. Keep the diagrams at the full article width so their labels remain readable. The cover contains no headline text, leaving the title editable in Medium. Its caption identifies it as AI-generated.

The diagrams are explanatory originals, generated as SVG and exported to PNG with librsvg. Rebuild them with `python3 build-diagrams.py` on a machine with `/opt/homebrew/bin/rsvg-convert`. The Full diagram describes a supported Full run, not Mini, automatic model diversity, or guaranteed correctness. The architecture diagram records the contemplated service design and Quorum's skill design, not a benchmark comparison.

The cover was produced with the built-in image-generation tool, then copied into this project. The original generated file was retained. Its complete prompt is saved in `cover-prompt.txt`. No image-generation API key or external Humanize service was used.

Validation: inspected both rendered diagrams, corrected a connector/text overlap, and inspected the generated cover. Checked embedded paths, image dimensions, captions and project-name exclusions. No publishing action was performed.
