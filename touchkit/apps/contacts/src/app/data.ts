/* Demo data for the Contacts app — verbatim from the TouchKit prototype. */
export const GROUPS = [
  { name: 'Work', color: '#0A84FF' },
  { name: 'Family', color: '#34C759' },
  { name: 'Friends', color: '#FF9F0A' },
  { name: 'Climbing', color: '#FF375F' },
];
const RAW: [string, string, string, string, string, number][] = [
  ['Amelia', 'Adler', 'Producer', 'Northlake Studio', 'Work', 1],
  ['Tunde', 'Abara', 'Data Engineer', 'Fielder Labs', 'Work', 0],
  ['Sofia', 'Alvarez', 'Pediatrician', 'Bayview Clinic', 'Friends', 0],
  ['Marcus', 'Bishop', 'Architect', 'Form & Field', 'Work', 0],
  ['Elena', 'Barros', 'Chef', 'Copper Kitchen', 'Friends', 1],
  ['Rowan', 'Blackwood', 'Novelist', '', '', 0],
  ['June', 'Calloway', 'Illustrator', 'Inkwell Co', 'Friends', 0],
  ['Wei', 'Chen', 'iOS Engineer', 'Parallel', 'Work', 1],
  ['Mateus', 'Costa', 'Physiotherapist', 'Motionworks', 'Climbing', 0],
  ['Yara', 'Delacroix', 'Curator', 'MOAD', '', 0],
  ['Rafael', 'Duarte', 'Barista', 'Cortado', 'Friends', 0],
  ['Nia', 'Ellery', 'Attorney', 'Ellery & Park', 'Work', 0],
  ['Vivian', 'Eng', 'Product Designer', 'Parallel', 'Work', 0],
  ['Cole', 'Farrow', 'Photographer', '', '', 0],
  ['Margaux', 'Fontaine', 'Sommelier', 'Vin Petit', 'Friends', 0],
  ['Declan', 'Gallagher', 'Contractor', 'Gallagher Bros', 'Family', 0],
  ['Lian', 'Guo', 'Research Lead', 'Fielder Labs', 'Work', 0],
  ['Imogen', 'Hale', 'Violinist', 'City Symphony', '', 1],
  ['Theo', 'Holloway', 'Teacher', 'Lakeside High', 'Family', 0],
  ['Mei', 'Huang', 'Cardiologist', 'St. Annes', '', 0],
  ['Camila', 'Ibarra', 'Landscape Architect', 'Terrafirma', 'Work', 0],
  ['Freya', 'Jansen', 'Pilot', 'Meridian Air', '', 0],
  ['Dev', 'Joshi', 'Backend Engineer', 'Parallel', 'Work', 0],
  ['Anya', 'Kowalski', 'Climbing Coach', 'Boulder Barn', 'Climbing', 1],
  ['Omar', 'Khan', 'Journalist', 'The Ledger', '', 0],
  ['Haruki', 'Kimura', 'Game Designer', 'Pixelfold', 'Friends', 0],
  ['Astrid', 'Lindqvist', 'UX Researcher', 'Parallel', 'Work', 0],
  ['Camille', 'Laurent', 'Pastry Chef', 'Mille-Feuille', 'Friends', 0],
  ['Kevin', 'Lam', 'Accountant', 'Lam & Co', 'Family', 0],
  ['Colette', 'Moreau', 'Editor', 'Gullwing Press', 'Work', 0],
  ['Jasper', 'Mercer', 'Bartender', 'The Alcove', 'Friends', 0],
  ['Priya', 'Menon', 'Neurologist', 'St. Annes', '', 0],
  ['Kenji', 'Nakamura', 'Woodworker', 'Grain Studio', 'Climbing', 0],
  ['Petra', 'Novak', 'Translator', '', '', 0],
  ['Chidi', 'Okafor', 'Founder', 'Lattice Health', 'Work', 1],
  ['Lucia', 'Ortiz', 'Muralist', '', 'Friends', 0],
  ['Dmitri', 'Petrov', 'Chess Coach', '', '', 0],
  ['Linh', 'Pham', 'Florist', 'Stem & Co', 'Family', 0],
  ['Saoirse', 'Quinn', 'Marine Biologist', 'Coastal Institute', '', 0],
  ['Ezra', 'Rhodes', 'Sound Engineer', 'Northlake Studio', 'Work', 0],
  ['Isabela', 'Rosario', 'Yoga Instructor', 'Stillpoint', 'Friends', 0],
  ['Tomas', 'Reyes', 'Electrician', 'Reyes Electric', 'Family', 0],
  ['Hana', 'Sato', 'Animator', 'Pixelfold', 'Work', 1],
  ['Julian', 'Sterling', 'Financial Advisor', 'Sterling Wealth', '', 0],
  ['Beatriz', 'Silva', 'Dentist', 'Smile SF', 'Family', 0],
  ['Aiko', 'Tanaka', 'Ceramicist', 'Kiln House', 'Friends', 0],
  ['August', 'Thorne', 'Park Ranger', 'Redwood NP', 'Climbing', 0],
  ['Rin', 'Ueda', 'Concept Artist', 'Pixelfold', 'Work', 0],
  ['Miriam', 'Vance', 'Librarian', 'Central Library', 'Family', 0],
  ['Zsofia', 'Varga', 'Physicist', 'Ion Lab', '', 0],
  ['Desmond', 'Whitfield', 'Jazz Pianist', 'Blue Door', 'Friends', 0],
  ['Clara', 'Winters', 'Veterinarian', 'Paws Clinic', 'Family', 0],
  ['Lin', 'Yang', 'Route Setter', 'Boulder Barn', 'Climbing', 1],
  ['Nadia', 'Zhang', 'VC Partner', 'Crescent Capital', 'Work', 0],
  ['Piotr', 'Zielinski', 'Baker', 'Rye & Co', 'Friends', 0],
];
export interface Contact {
  id: string; f: string; l: string; role: string; com: string; g: string;
  fav: boolean; ph: string; em: string;
}
export const CONTACTS: Contact[] = RAW.map((r, i) => ({
  id: (r[0] + r[1]).toLowerCase().replace(/[^a-z]/g, ''),
  f: r[0], l: r[1], role: r[2], com: r[3], g: r[4], fav: !!r[5],
  ph: `(628) 555-0${((113 + i * 37) % 900) + 100}`,
  em: (r[0] + '.' + r[1]).toLowerCase().replace(/[^a-z.]/g, '') + '@' +
    (r[3] ? r[3].toLowerCase().replace(/[^a-z]/g, '') : 'hey') + '.com',
}));
export const RECENTS = new Set(['ameliaadler', 'weichen', 'anyakowalski', 'hanasato', 'chidiokafor', 'junecalloway', 'ezrarhodes', 'linyang']);
export const RINGTONES = ['Reflection', 'Chimes', 'Circuit', 'Cosmic', 'Duet', 'Night Owl', 'Presto', 'Radiate', 'Signal', 'Silk', 'Stargaze', 'Summit'];
export const NOTES: Record<string, string> = {
  weichen: 'Ships the haptics engine. Wants the index-scrub tick at exactly 4ms.',
  anyakowalski: 'Tuesday 6am sessions. Bring chalk, she never has spare.',
  ameliaadler: 'Prefers async voice memos over meetings.',
  hanasato: 'Working on the onboarding animation — check in Friday.',
  chidiokafor: 'Intro to the Parallel design team pending.',
};
export const TINTS = ['#0A84FF', '#5E5CE6', '#30B0C7', '#34C759', '#FF9F0A', '#FF375F'];
export const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
