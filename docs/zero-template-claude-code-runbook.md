# Claude Code + Remotion đối chứng (zero-template §10)

Manual protocol to compare MotiClip zero-template output against a coding-agent Remotion project for the same brief.

## Setup

1. Pick brief from `docs/fixtures/ai/zero/` (start with Z1).
2. Run MotiClip stub/live generation; keep `tmp/ai-generations/<seed>/project.mt.json` + MP4 via `/api/export`.
3. In a clean folder, ask Claude Code to build a Remotion composition matching the same brief script/duration/aspect — no MotiClip APIs.

## Sheet columns

| Column | MotiClip | Claude+Remotion |
|---|---|---|
| Time to first playable preview | | |
| Time to accepted MP4 | | |
| Compile/runtime errors | | |
| Editable without code | | |
| Undo / select element | | |
| Asset ID inventing | | |
| Human edits to publishable | | |

## Rules

- Same brief text, duration, aspect ratio.
- MotiClip must not use templates/retrieval.
- Claude path may use Remotion freely (baseline coding-agent workflow).
- Record qualitative notes; attach MP4 paths.

## Outcome

Paste results into the go/no-go report under product advantage (H5). Template phase still depends on MotiClip hard gates, not on winning every qualitative column.
