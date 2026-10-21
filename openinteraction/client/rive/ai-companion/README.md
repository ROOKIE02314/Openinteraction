# AI Companion Rive source

`scene.rml` is the editable source for the interview companion. The generated
runtime asset is checked in at `client/public/rive/ai-companion.riv` so normal
frontend builds do not need the Rive CLI.

## Runtime contract

The `Companion` view model exposes:

- `mode`: `idle`, `listening`, `thinking`, `speaking`, or `error`
- `lookX`: normalized horizontal gaze from `-1` to `1`
- `lookY`: normalized vertical gaze from `-1` to `1`
- `react`: one-shot trigger for click/tap feedback

React remains the source of truth for application state. Rive only owns visual
motion and transitions.

## Rebuild

Install the official Rive CLI, then run from `client/`:

```bash
npm run build:companion
```

Validate visual changes from this directory with:

```bash
rive . --verify
rive inspect . --summary
rive . --screenshot=build/preview.png --advance=30
```
