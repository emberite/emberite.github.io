// Hand-written copy for each module. Everything else (version, release date,
// manifest, requirements, screenshots and their captions) is pulled from the
// GitHub API by build.mjs. A new dh-* repo without an entry here still gets a
// section, built from its repo description and README.

export const site = {
  owner: 'emberite',
  repoPrefix: 'dh-',
  title: 'emberite · Daggerheart modules for Foundry VTT',
  description:
    'Free Foundry VTT modules for the campaign frames of Daggerheart: cooking with Hotpot, factions with Five Banners, hex crawls with Horizon and the Weredragon table tools.',
};

// Order of the sections on the page. Repos not listed here come after, by name.
export const order = ['dh-hotpot', 'dh-5banners', 'dh-horizon', 'dh-weredragon'];

export const modules = {
  'dh-hotpot': {
    short: 'Hotpot',
    frame: 'Beast Feast',
    source: 'Daggerheart Core Rulebook',
    accent: '#f08a3c',
    tagline: 'Cooking as a shared, animated scene at the table.',
    blurb:
      'Throw ingredients into the pot, roll the flavor dice, collect matches and serve the Meal Rating to the party. Every connected player watches the cook live, and every dish lands in the party cookbook.',
    hero: 'kitchen-pot.webp',
    features: [
      ['The kitchen', 'Prep, cook and serve in one window: the pantry, the pot, the flavor dice and the recipe card, with Last Drop, Risky, Spicy and Built for Speed handled for you.'],
      ['Cooking together', 'Call everyone to the pot and the kitchen opens for every player, mirroring each roll, match and discard.'],
      ['Ingredient Generator', 'Harvest a beast by its HP and tier, roll a bloom on the Hope Die, or build a custom ingredient, then hand out servings in one click.'],
      ['45 food-themed adversaries', 'From Fryling Swarms to the Mac and Cheese Colossus, across Tiers 1–4, each listing what it yields.'],
    ],
  },
  'dh-5banners': {
    short: 'Five Banners',
    frame: 'Five Banners Burning',
    source: 'Daggerheart Core Rulebook',
    accent: '#e0b049',
    tagline: 'Factions, relationships and reputation for the five nations of Althas.',
    blurb:
      'The GM builds the factions of the campaign and hands each one to the characters as they meet it. Every character sheet gets a Factions tab showing who they know, how those factions feel about each other and where the character stands with each.',
    hero: '01-factions-tab-v2.webp',
    features: [
      ['Factions tab', 'A new tab on every character sheet with banners, relationships and a reputation track per faction.'],
      ['The Five Nations in one click', 'Armada, Hilltop, Jesthaen, Polaris and Voldaen, with their banners and the relationship ratings from the campaign frame.'],
      ['Objective countdowns', 'Major and minor faction objectives run on the system’s own countdowns, hidden from players until you reveal them.'],
      ['Reputation (homebrew)', 'Marks for deeds done for or against a faction shift a character from Nemeses to Close Allies.'],
    ],
  },
  'dh-horizon': {
    short: 'Horizon',
    frame: 'Journey to Horizon',
    source: 'Daggerheart: Hope & Fear',
    accent: '#4fb3d9',
    tagline: 'A hex crawl of New Valloren, rolled on the fly from the campaign’s dice tables.',
    blurb:
      'Horizon builds the continent, rolls the wilderness as the party approaches, and runs the journey hex by hex: travel days, Encounter Dice, ocean weather, rests, Soul Echoes and the Doom Track. The GM sees the key map; the players see what they’ve crossed.',
    hero: '02-gm-key-map.webp',
    features: [
      ['Map builder', 'A continent from Marrogate to the Cliffs of Horizon, with sanctuaries and nine Soul Echoes placed as the book suggests.'],
      ['Wilderness on the fly', 'Habitat, region size, encounter, terrain and rumor are rolled for each region as the party draws near.'],
      ['The journey', 'Move the token: travel days, Encounter Dice and ocean weather are rolled for every hex entered, with GM-only cards.'],
      ['Rests, Echoes and Doom', 'Short-rest limits, the Locate Soul Echoes downtime move, levelling with the Vessel of Light, and the Doom Track.'],
    ],
  },
  'dh-weredragon': {
    short: 'Weredragon',
    frame: 'Reign of the Weredragon',
    source: 'Daggerheart: Hope & Fear',
    accent: '#a98bf0',
    tagline: 'Build the weredragon queen together, then read her fate in the stars.',
    blurb:
      'Two shared table apps for session zero, the Villain Builder and the Astromancer’s Night Sky Reading, plus compendiums for Forlorne Lykona, her weredrakes, the two curses and the curse-breaking Keys to Victory.',
    hero: '07-sky-revelations-v2.webp',
    features: [
      ['Villain Builder', 'The whole table draws folded slips or rolls the prompts, answers them in turn, and the answers are written to a journal.'],
      ['Night Sky Reading', 'The players roll the stars, the GM reads the sky into a constellation, and the five revelations appear for everyone.'],
      ['Forlorne Lykona', 'Her Faun and Dragon forms, with Transform swapping the token while keeping HP, Stress and conditions.'],
      ['Curses, automated', 'Weredrake and Petrified curses as status conditions that reshape or petrify the token, broken by the Keys to Victory.'],
    ],
  },
};
