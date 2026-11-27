/**
 * Fake data for dev.html. Shapes follow architecture.md §3.
 * The base map is the team's campus map. Place positions are read off its building labels (rough).
 * Photos are the real ones from Tim's guide. Distances, times and the other extra step fields are made up, only the format matters.
 */

const W = 1000;
const H = 1000;

/** The team's campus map (images/campus-map.png, 1000 x 1000). dev-standalone.html has it built in. */
const background = (typeof window !== 'undefined' && window.__IMAGES && window.__IMAGES['campus-map']) || 'images/campus-map.png';

/** Real photos from Tim's guide (route A), exported to images/routeA/. */
// (dev-standalone.html has the pictures built in as window.__IMAGES; the project uses the files)
const photo = (id, caption) => ({
    id,
    caption,
    url: (typeof window !== 'undefined' && window.__IMAGES && window.__IMAGES[id]) || `images/routeA/${id}.jpg`,
});

// positions of the building labels on the map, divided by 1000. Rough, real door positions come from Tim's survey.
const node = {
    A: [0.415, 0.953], B: [0.421, 0.888], C: [0.409, 0.78], D: [0.503, 0.795],
    E: [0.503, 0.727], F: [0.465, 0.663], G: [0.425, 0.592], H: [0.405, 0.505],
    M: [0.445, 0.628], N: [0.412, 0.556],
};

const labels = {
    A: 'ICICS/CS (ICCS)', B: 'McLeod (MCLD)', C: 'Kaiser (KAIS)', D: 'CEME',
    E: 'CEML', F: 'Beaty (BETY)', G: 'AERL', H: 'BIOL West Wing',
};

export const fakeMap = {
    imageUrl: background,
    width: W,
    height: H,
    buildings: [], // the real map already shows the buildings; outlines would only be needed to make them clickable
    places: Object.keys(labels).map((k) => ({ id: `N-${k}`, label: labels[k], x: node[k][0], y: node[k][1] })),
};

export const fakeMeta = {
    dataVersion: '2026-11-05.1 (fake)',
    places: fakeMap.places.map(({ id, label }) => ({ id, label })),
};

const seg = (edgeId, cover, ...keys) => ({ edgeId, cover, points: keys.map((k) => node[k]) });

const drySegments = [
    seg('E-01', 'indoor', 'A', 'B'),
    seg('E-02', 'indoor', 'B', 'C'),
    seg('E-03', 'indoor', 'C', 'D'),
    seg('E-04', 'indoor', 'D', 'E'),
    seg('E-05', 'outdoor', 'E', 'F'),
    seg('E-06', 'indoor', 'F', 'M'),
    seg('E-07', 'outdoor', 'M', 'G'),
    seg('E-08', 'indoor', 'G', 'N'),
    seg('E-09', 'outdoor', 'N', 'H'),
];

const dryOption = {
    kind: 'LOWER_EXPOSURE',
    distanceM: 705,
    walkSeconds: 560,
    exposedM: 70,
    extraSeconds: 90,
    exposureReductionM: 350,
    segments: drySegments,
    steps: [
        {
            title: 'ICICS/CS', text: 'Take elevator #4 up to level 2, then go through the door to McLeod.', edgeIds: ['E-01'],
            cover: 'indoor', hours: 'Mon–Fri 07:30–17:00',
            details: ['Enter through the main door (2366 Main Mall).', 'Find elevator #4 and go to level 2.', 'Push the door marked "To Area of Refuge & McLeod Building".'],
            photos: [photo('A1', 'ICICS/CS main door'), photo('A2', 'Code lock and accessible door button'), photo('A3', 'Elevator #4'), photo('A4', 'Level 2 door to McLeod')],
        },
        {
            title: 'McLeod', text: 'Follow the curved glass walkway, then the long corridor.', edgeIds: ['E-02'],
            cover: 'indoor', hours: 'Mon–Fri 07:30–20:00',
            photos: [photo('B1', 'Curved glass walkway'), photo('B2', 'McLeod long corridor')],
        },
        {
            title: 'Kaiser', text: 'Cross the Kaiser lobby and take the corridor at the sign "1130–1230".', edgeIds: ['E-03'],
            cover: 'indoor', hours: 'Mon–Fri 07:30–18:00',
            photos: [photo('C1', '"To Kaiser Building" door'), photo('C2', '"Entering Kaiser Building"'), photo('C3', 'Kaiser ground-floor lobby'), photo('C4', '"1130–1230" corridor')],
        },
        {
            title: 'CEME and the wooden bridge', text: 'Follow the CEME signs to the wooden bridge. Show your UBCcard at the red door.', edgeIds: ['E-04'],
            cover: 'indoor', cardReader: true, hours: 'Mon–Fri 07:30–17:00',
            pending: 'Which way the Civil Labs sign points is not confirmed on site.',
            photos: [photo('D1', 'Corridor with "CEME Building" sign'), photo('D2', 'Water valve room, do not enter'), photo('D3', 'Blue wall and "Bridge to CHBE Labs"'), photo('D4', 'Wooden glass bridge'), photo('D5', 'Fire door at the end of the bridge'), photo('E1', '"Show your ID" door')],
        },
        {
            text: 'Leave through the glass door and walk the garden path to Beaty.', edgeIds: ['E-05'], cover: 'outdoor',
            photos: [photo('E4', 'Glass door to the garden'), photo('E5', 'Chandos Site Office sign and glass door'), photo('F1', 'Beaty door (2212 Main Mall)')],
        },
        {
            title: 'Beaty Biodiversity Centre', text: 'Walk through the museum hall to the exit on the Atrium side.', edgeIds: ['E-06'],
            cover: 'indoor', cardReader: true, hours: 'Mon–Fri 07:30–17:00',
            pending: 'The museum is closed on Mondays. The hall may be blocked then.',
            photos: [photo('F2', 'Lobby'), photo('F3', 'Museum hall'), photo('F4', 'Museum exit and opening hours')],
        },
        { text: 'Walk north outside to AERL.', edgeIds: ['E-07'], cover: 'outdoor', photos: [photo('G1', 'AERL entrance glass door')] },
        {
            title: 'AERL', text: 'Take the ground-floor corridor to the far door.', edgeIds: ['E-08'], cover: 'indoor', cardReader: true, hours: 'Mon–Fri 07:30–17:00',
            photos: [photo('G2', 'AERL ground-floor corridor'), photo('G3', 'Far door and access notice')],
        },
        {
            text: 'Walk outside to the BIOL West Wing door.', edgeIds: ['E-09'], cover: 'outdoor',
            photos: [photo('H1', 'West Wing glass doors'), photo('H2', 'Wooden-ceiling corridor'), photo('H3', 'EXIT double doors'), photo('H4', 'End point: West Wing sign')],
        },
    ],
};

const fastOption = {
    kind: 'FASTEST',
    distanceM: 640,
    walkSeconds: 480,
    exposedM: 420,
    extraSeconds: 0,
    exposureReductionM: 0,
    segments: [
        { edgeId: 'E-10', cover: 'outdoor', points: [node.A, [0.53, 0.93], [0.53, 0.84], node.D] },
        { edgeId: 'E-11', cover: 'covered', points: [node.D, node.E, node.F] },
        { edgeId: 'E-12', cover: 'outdoor', points: [node.F, node.G, node.H] },
    ],
    steps: [
        { text: 'Walk 210 m outdoors along Main Mall to CEME.', edgeIds: ['E-10'], cover: 'outdoor' },
        { text: 'Walk 90 m under the covered walkway to Beaty.', edgeIds: ['E-11'], cover: 'covered' },
        { text: 'Walk 120 m outdoors to BIOL West Wing.', edgeIds: ['E-12'], cover: 'outdoor' },
    ],
};

/** The four things the server can answer, for the scenario picker. */
export const scenarios = {
    two: { dataVersion: fakeMeta.dataVersion, status: 'COMPLETE', identical: false, options: [fastOption, dryOption] },
    same: { dataVersion: fakeMeta.dataVersion, status: 'COMPLETE', identical: true, options: [fastOption] },
    none: { dataVersion: fakeMeta.dataVersion, status: 'NO_FEASIBLE_ROUTE', identical: false, options: [] },
};
