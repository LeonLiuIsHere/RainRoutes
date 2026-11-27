# Client integration notes

Owner: Ryan (ClientController, ClientState, RemoteData, MessageView, main.js, index.html).
Checked against Yuki's views in PR #3 (`yuki-views`).

## Tests

```
npm test            # 74 unit tests, Node 22+, no install needed
npm run coverage    # unit tests plus a coverage table
npm install         # once, for the next command (installs jsdom)
npm run e2e         # end-to-end: real index.html + Yuki's views + client code in jsdom,
                    # with a fake server (no route, service error + Retry, two routes, steps, Back)
```

`node_modules/` must be in `.gitignore`.

## Page

`index.html` is `dev.html` without the fake-data bar, and it loads `js/main.js`.
`main.js` builds the views, turns `#layout` into the BottomSheet, keeps
`MapView.setBottomInset` equal to the sheet height, and switches
`#layout[data-screen]` between `plan` and `detail`.
Element ids (`ELEMENT_IDS` in `main.js`): `app`, `map`, `layout`, `home`, `cmp`, `detail`, `footer`.

## Views

`main.js` is the only file that calls Yuki's views (see `createUi`). Shapes it passes:

- `MapView.renderMap`: `{imageUrl, width, height, buildings: [{id, name, outline: [[x, y]]}], places: [{id, label, x, y}]}`
- `RouteComparisonView.render`: the route result `{dataVersion, status, identical, options}`
- segment: `{edgeId, cover: 'indoor' | 'covered' | 'outdoor', points: [[x, y]]}`
- step: `{text, edgeIds}` plus any optional fields the server sends (`title`, `cover`, `photos`, `hours`, ...)

MessageView is Yuki's version (same DOM and CSS classes) plus `showInfo(text)`
and `showError(text, {retry})`. Use this file when merging PR #3.

## Server (Leon, Stark)

`GET /api/meta`, `GET /api/map`, `POST /api/routes` (architecture §3).

- Every response includes `dataVersion`.
- `data/map.json`: `imageUrl` should be `images/campus-map.png` (the file in
  `src/main/resources/public/images/`, served as a static file).
- `label` must be a plain string. For `Optional<String>`, register Jackson's `Jdk8Module`.
- Validation errors: HTTP 400 with
  `{"dataVersion": "...", "error": {"code": "VALIDATION_ERROR", "fields": [{"field": "...", "problem": "..."}]}}`.
- Any other non-2xx status, invalid JSON or a timeout (15 s) is shown as
  "Service error" with Retry, never as "no route".
