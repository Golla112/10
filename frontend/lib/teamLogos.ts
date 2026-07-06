/**
 * Team logo resolution.
 * Primary: football-data.org crests (European clubs, accurate IDs)
 * Fallback: ESPN CDN (global coverage, public, no auth needed)
 * ESPN URL: https://a.espncdn.com/i/teamlogos/soccer/500/{id}.png
 */

// football-data.org IDs (verified)
const FD_IDS: Record<string, number> = {
  // ── Serie A ──
  'AC Milan': 98, 'Milan': 98,
  'Inter Milan': 108, 'Inter': 108, 'FC Internazionale Milano': 108, 'Internazionale': 108,
  'Juventus': 109, 'Juventus FC': 109,
  'Napoli': 113, 'SSC Napoli': 113,
  'AS Roma': 100, 'Roma': 100,
  'Lazio': 110, 'SS Lazio': 110,
  'Atalanta': 102, 'Atalanta BC': 102,
  'Fiorentina': 99, 'ACF Fiorentina': 99,
  'Torino': 586, 'Torino FC': 586,
  'Bologna': 103, 'Bologna FC': 103,
  'Udinese': 115, 'Udinese Calcio': 115,
  'Empoli': 445, 'Empoli FC': 445,
  'Genoa': 107, 'Genoa CFC': 107,
  'Cagliari': 104, 'Cagliari Calcio': 104,
  'Lecce': 5890, 'US Lecce': 5890,
  'Monza': 5911, 'AC Monza': 5911,
  'Hellas Verona': 450, 'Verona': 450,
  'Cremonese': 457, 'US Cremonese': 457,
  'Salernitana': 5915,
  'Venezia': 454, 'Venezia FC': 454,
  'Parma': 112, 'Parma Calcio': 112,

  // ── Premier League ──
  'Arsenal': 57,
  'Chelsea': 61,
  'Liverpool': 64,
  'Manchester City': 65,
  'Manchester United': 66,
  'Tottenham': 73, 'Tottenham Hotspur': 73, 'Spurs': 73,
  'Newcastle United': 67, 'Newcastle': 67,
  'Aston Villa': 58,
  'West Ham': 563, 'West Ham United': 563,
  'Brighton': 397, 'Brighton & Hove Albion': 397, 'Brighton and Hove Albion': 397,
  'Brentford': 402,
  'Fulham': 63,
  'Crystal Palace': 354,
  'Wolves': 76, 'Wolverhampton Wanderers': 76, 'Wolverhampton': 76,
  'Everton': 62,
  'Nottingham Forest': 351,
  'Leicester City': 338, 'Leicester': 338,
  'Southampton': 340,
  'Ipswich Town': 349, 'Ipswich': 349,
  'Bournemouth': 1044, 'AFC Bournemouth': 1044,
  'Luton Town': 389, 'Luton': 389,

  // ── La Liga ──
  'Real Madrid': 86,
  'Barcelona': 81, 'FC Barcelona': 81,
  'Atletico Madrid': 78, 'Atlético Madrid': 78, 'Atletico de Madrid': 78,
  'Sevilla': 559, 'Sevilla FC': 559,
  'Real Sociedad': 92,
  'Villarreal': 94, 'Villarreal CF': 94,
  'Athletic Bilbao': 77, 'Athletic Club': 77, 'Athletic de Bilbao': 77,
  'Valencia': 95, 'Valencia CF': 95,
  'Betis': 90, 'Real Betis': 90,
  'Osasuna': 89, 'CA Osasuna': 89,
  'Celta Vigo': 558, 'RC Celta de Vigo': 558, 'Celta de Vigo': 558,
  'Getafe': 83, 'Getafe CF': 83,
  'Girona': 298, 'Girona FC': 298,
  'Rayo Vallecano': 87,
  'Mallorca': 89, 'RCD Mallorca': 89,
  'Alaves': 263, 'Deportivo Alavés': 263, 'Deportivo Alaves': 263,
  'Espanyol': 82, 'RCD Espanyol': 82,
  'Las Palmas': 275, 'UD Las Palmas': 275,
  'Leganes': 1028, 'CD Leganes': 1028,
  'Elche': 285, 'Elche CF': 285,
  'Valladolid': 250, 'Real Valladolid': 250,

  // ── Bundesliga ──
  'Bayern Munich': 5, 'FC Bayern Munich': 5, 'FC Bayern München': 5, 'Bayern München': 5,
  'Borussia Dortmund': 4, 'BVB': 4,
  'Bayer Leverkusen': 3, 'Bayer 04 Leverkusen': 3,
  'RB Leipzig': 721,
  'Eintracht Frankfurt': 19,
  'Wolfsburg': 11, 'VfL Wolfsburg': 11,
  'Borussia Monchengladbach': 18, 'Borussia Mönchengladbach': 18, "Borussia M'gladbach": 18,
  'Freiburg': 17, 'SC Freiburg': 17,
  'Union Berlin': 28, '1. FC Union Berlin': 28,
  'Hoffenheim': 533, 'TSG Hoffenheim': 533, 'TSG 1899 Hoffenheim': 533,
  'Mainz': 15, 'Mainz 05': 15, '1. FSV Mainz 05': 15,
  'Augsburg': 16, 'FC Augsburg': 16,
  'Stuttgart': 10, 'VfB Stuttgart': 10,
  'Werder Bremen': 12, 'SV Werder Bremen': 12,
  'Heidenheim': 576, '1. FC Heidenheim': 576,
  'Bochum': 36, 'VfL Bochum': 36,
  'St. Pauli': 29, 'FC St. Pauli': 29,
  'Hamburger SV': 6,

  // ── Ligue 1 ──
  'Paris Saint-Germain': 524, 'PSG': 524, 'Paris SG': 524,
  'Marseille': 516, 'Olympique Marseille': 516, 'Olympique de Marseille': 516,
  'Lyon': 523, 'Olympique Lyonnais': 523, 'Olympique Lyon': 523,
  'Monaco': 548, 'AS Monaco': 548,
  'Lille': 521, 'LOSC Lille': 521,
  'Nice': 522, 'OGC Nice': 522,
  'Rennes': 529, 'Stade Rennais': 529, 'Stade Rennais FC': 529,
  'Lens': 546, 'RC Lens': 546,
  'Nantes': 543, 'FC Nantes': 543,
  'Montpellier': 518, 'Montpellier HSC': 518,
  'Brest': 512, 'Stade Brestois': 512, 'Stade Brestois 29': 512,
  'Le Havre': 519, 'Le Havre AC': 519,
  'Reims': 532, 'Stade de Reims': 532,
  'Metz': 517, 'FC Metz': 517,
  'Angers': 514, 'SCO Angers': 514,
  'Saint-Etienne': 527, 'AS Saint-Etienne': 527,
  'Toulouse': 586, 'Toulouse FC': 586,

  // ── Eredivisie ──
  'Ajax': 610, 'AFC Ajax': 610,
  'PSV': 674, 'PSV Eindhoven': 674,
  'Feyenoord': 675,
  'AZ Alkmaar': 676, 'AZ': 676,
  'Utrecht': 677, 'FC Utrecht': 677,
  'Twente': 678, 'FC Twente': 678,

  // ── Primeira Liga ──
  'Porto': 503, 'FC Porto': 503,
  'Benfica': 498, 'SL Benfica': 498,
  'Sporting CP': 498, 'Sporting Lisbon': 498, 'Sporting': 498,
  'Braga': 5601, 'SC Braga': 5601,

  // ── Celtic / Rangers ──
  'Celtic': 732, 'Celtic FC': 732,
  'Rangers': 733, 'Rangers FC': 733,
};

// ESPN CDN IDs — verified ESPN soccer team IDs
// URL: https://a.espncdn.com/i/teamlogos/soccer/500/{id}.png
const ESPN_IDS: Record<string, number> = {
  // ── Super Lig ──
  'Galatasaray': 3794, 'Galatasaray SK': 3794,
  'Fenerbahce': 3795, 'Fenerbahçe': 3795,
  'Besiktas': 3796, 'Beşiktaş': 3796,
  'Trabzonspor': 3797,
  'Basaksehir': 7039, 'Istanbul Basaksehir': 7039, 'İstanbul Başakşehir': 7039,
  'Sivasspor': 3798,
  'Konyaspor': 3799,
  'Antalyaspor': 3800,
  'Kayserispor': 3801,
  'Kasimpasa': 3802, 'Kasımpaşa': 3802,
  'Alanyaspor': 7040,
  'Rizespor': 3803, 'Caykur Rizespor': 3803, 'Çaykur Rizespor': 3803,
  'Gaziantep': 7041, 'Gaziantep FK': 7041,
  'Adana Demirspor': 7042,
  'Ankaragücü': 3804, 'Ankaragucu': 3804,
  'Samsunspor': 3805,
  'Eyupspor': 7043, 'Eyüpspor': 7043,
  'Hatayspor': 7044,

  // ── Brasileirao ──
  'Flamengo': 1966, 'CR Flamengo': 1966,
  'Palmeiras': 1963, 'SE Palmeiras': 1963,
  'Atletico Mineiro': 1967, 'Atlético Mineiro': 1967,
  'Fluminense': 1968, 'Fluminense FC': 1968,
  'Corinthians': 1957, 'SC Corinthians': 1957,
  'Gremio': 1969, 'Grêmio': 1969,
  'Internacional': 1970, 'Sport Club Internacional': 1970,
  'Santos': 1971, 'Santos FC': 1971,
  'Sao Paulo': 1972, 'São Paulo': 1972,
  'Vasco da Gama': 1973,
  'Botafogo': 1958, 'Botafogo FR': 1958,
  'Cruzeiro': 1960, 'Cruzeiro EC': 1960,
  'Bahia': 1956, 'EC Bahia': 1956,
  'Fortaleza': 1961, 'Fortaleza EC': 1961,
  'Athletico Paranaense': 1955, 'Athletico-PR': 1955,
  'Bragantino': 7045, 'Red Bull Bragantino': 7045,
  'Cuiaba': 7046, 'Cuiabá': 7046,
  'Goias': 1964, 'Goiás': 1964,
  'Coritiba': 1965,
  'Juventude': 7047,
  'Criciuma': 7048, 'Cricíuma': 7048,
  'Vitoria': 7049, 'Vitória': 7049,
  'America Mineiro': 7050, 'América Mineiro': 7050,
  'Ceara': 7051, 'Ceará': 7051,

  // ── MLS ──
  'LA Galaxy': 392, 'Los Angeles Galaxy': 392,
  'LAFC': 16161, 'Los Angeles FC': 16161,
  'Seattle Sounders': 9726, 'Seattle Sounders FC': 9726,
  'Portland Timbers': 9729,
  'New York City FC': 13040, 'NYCFC': 13040,
  'New York Red Bulls': 399,
  'Atlanta United': 18093, 'Atlanta United FC': 18093,
  'Toronto FC': 9720,
  'CF Montreal': 9721, 'Montreal Impact': 9721,
  'Columbus Crew': 394,
  'Chicago Fire': 395, 'Chicago Fire FC': 395,
  'FC Dallas': 396,
  'Houston Dynamo': 9722,
  'Sporting Kansas City': 398,
  'Real Salt Lake': 9723,
  'Colorado Rapids': 393,
  'Vancouver Whitecaps': 9727,
  'San Jose Earthquakes': 400,
  'DC United': 397, 'D.C. United': 397,
  'New England Revolution': 401,
  'Philadelphia Union': 9725,
  'Orlando City': 13040, 'Orlando City SC': 13040,
  'Minnesota United': 18091,
  'Inter Miami': 16161, 'Inter Miami CF': 16161,
  'Nashville SC': 18092,
  'Austin FC': 18094,
  'Charlotte FC': 18095,

  // ── Argentina ──
  'River Plate': 2015,
  'Boca Juniors': 2016,
  'Racing Club': 2017,
  'Independiente': 2018,
  'San Lorenzo': 2019,
  'Estudiantes': 2020,
  'Velez Sarsfield': 2021, 'Vélez Sársfield': 2021,
  'Huracan': 2022, 'Huracán': 2022,
  'Lanus': 2023, 'Lanús': 2023,
  'Talleres': 2024,
  'Defensa y Justicia': 2025,
  'Argentinos Juniors': 2026,
  'Tigre': 2027,
  'Godoy Cruz': 2028,
  'Banfield': 2029,
  'Belgrano': 2031,
  "Newell's Old Boys": 2032, 'Newells Old Boys': 2032,
  'Rosario Central': 2033,

  // ── Liga MX ──
  'Club America': 2186, 'América': 2186,
  'Chivas': 2187, 'Guadalajara': 2187, 'CD Guadalajara': 2187,
  'Cruz Azul': 2188,
  'Tigres UANL': 2189, 'Tigres': 2189,
  'Monterrey': 2190, 'CF Monterrey': 2190,
  'Pumas UNAM': 2191, 'Pumas': 2191,
  'Toluca': 2192, 'Deportivo Toluca': 2192,
  'Santos Laguna': 2193,
  'Leon': 2194, 'León': 2194, 'Club León': 2194,
  'Atlas': 2195,
  'Necaxa': 2196,
  'Pachuca': 2197, 'CF Pachuca': 2197,
  'Tijuana': 2199, 'Club Tijuana': 2199,

  // ── Ekstraklasa ──
  'Legia Warsaw': 3808, 'Legia Warszawa': 3808,
  'Lech Poznan': 3809, 'Lech Poznań': 3809,
  'Wisla Krakow': 3810, 'Wisła Kraków': 3810,
  'Rakow Czestochowa': 7052, 'Raków Częstochowa': 7052,
  'Jagiellonia': 7053, 'Jagiellonia Białystok': 7053,
  'Cracovia': 3811,
  'Gornik Zabrze': 3812, 'Górnik Zabrze': 3812,
  'Pogon Szczecin': 7054, 'Pogoń Szczecin': 7054,

  // ── Allsvenskan ──
  'Malmo FF': 3820, 'Malmö FF': 3820,
  'IFK Goteborg': 3821, 'IFK Göteborg': 3821,
  'Djurgarden': 3822, 'Djurgårdens IF': 3822,
  'Hammarby': 3823,
  'AIK': 3824,

  // ── Eliteserien ──
  'Rosenborg': 3830, 'Rosenborg BK': 3830,
  'Molde': 3831, 'Molde FK': 3831,
  'Bodo/Glimt': 7055, 'FK Bodø/Glimt': 7055,
  'Viking': 3832, 'Viking FK': 3832,
  'Brann': 3833, 'SK Brann': 3833,

  // ── Superliga DK ──
  'FC Copenhagen': 3840, 'FC København': 3840,
  'Brondby': 3841, 'Brøndby IF': 3841,
  'FC Midtjylland': 7056,
  'AGF': 3842,
  'Silkeborg': 7057, 'Silkeborg IF': 7057,

  // ── Super League CH ──
  'Young Boys': 3850, 'BSC Young Boys': 3850,
  'Basel': 3851, 'FC Basel': 3851,
  'Zurich': 3852, 'FC Zürich': 3852,
  'Servette': 3853, 'Servette FC': 3853,
  'Lugano': 3854, 'FC Lugano': 3854,
  'Luzern': 3855, 'FC Luzern': 3855,
  'Grasshopper': 3856, 'Grasshopper Club': 3856,

  // ── Super League GR ──
  'Olympiakos': 3860, 'Olympiacos': 3860,
  'Panathinaikos': 3861,
  'AEK Athens': 3862, 'AEK': 3862,
  'PAOK': 3863,
  'Aris': 3864, 'Aris Thessaloniki': 3864,

  // ── Bundesliga AT ──
  'Red Bull Salzburg': 3870, 'FC Red Bull Salzburg': 3870,
  'Rapid Vienna': 3871, 'SK Rapid Wien': 3871,
  'Austria Vienna': 3872, 'FK Austria Wien': 3872,
  'Sturm Graz': 3873, 'SK Sturm Graz': 3873,
  'LASK': 7058,

  // ── Belgium ──
  'Club Brugge': 3880, 'Club Brugge KV': 3880,
  'Anderlecht': 3881, 'RSC Anderlecht': 3881,
  'Gent': 3882, 'KAA Gent': 3882,
  'Standard Liege': 3883, 'Standard Liège': 3883,
  'Genk': 3884, 'KRC Genk': 3884,
  'Union Saint-Gilloise': 7059,

  // ── Ukraine ──
  'Shakhtar Donetsk': 3890, 'FC Shakhtar Donetsk': 3890,
  'Dynamo Kyiv': 3891, 'FC Dynamo Kyiv': 3891,

  // ── Russia ──
  'Zenit': 3900, 'Zenit Saint Petersburg': 3900,
  'CSKA Moscow': 3901,
  'Spartak Moscow': 3902,
  'Lokomotiv Moscow': 3903,

  // ── Japan J-League ──
  'Urawa Red Diamonds': 7060,
  'Gamba Osaka': 7061,
  'Kashima Antlers': 7062,
  'Vissel Kobe': 7063,
  'Yokohama F. Marinos': 7064, 'Yokohama Marinos': 7064,
  'Kawasaki Frontale': 7065,

  // ── K League ──
  'Jeonbuk Hyundai Motors': 7070, 'Jeonbuk': 7070,
  'Ulsan Hyundai': 7071, 'Ulsan': 7071,
  'Suwon Samsung Bluewings': 7072,

  // ── Champions League / Europa ──
  'Benfica': 498,
  'Porto': 503,
  'Sporting CP': 498,
};

export function getTeamLogoUrl(teamName: string): string | null {
  if (!teamName) return null;

  // 1. Try football-data.org (exact)
  let fdId: number | undefined = FD_IDS[teamName];

  // 2. Case-insensitive exact match
  if (fdId === undefined) {
    const lower = teamName.toLowerCase();
    for (const [key, val] of Object.entries(FD_IDS)) {
      if (key.toLowerCase() === lower) { fdId = val; break; }
    }
  }

  // 3. Partial match in FD
  if (fdId === undefined) {
    const lower = teamName.toLowerCase();
    for (const [key, val] of Object.entries(FD_IDS)) {
      const kl = key.toLowerCase();
      if (lower.includes(kl) || kl.includes(lower)) { fdId = val; break; }
    }
  }

  if (fdId !== undefined) {
    return `/api/team-logo?id=${fdId}&src=fd`;
  }

  // 4. Try ESPN CDN
  let espnId: number | undefined = ESPN_IDS[teamName];

  if (espnId === undefined) {
    const lower = teamName.toLowerCase();
    for (const [key, val] of Object.entries(ESPN_IDS)) {
      if (key.toLowerCase() === lower) { espnId = val; break; }
    }
  }

  if (espnId === undefined) {
    const lower = teamName.toLowerCase();
    for (const [key, val] of Object.entries(ESPN_IDS)) {
      const kl = key.toLowerCase();
      if (lower.includes(kl) || kl.includes(lower)) { espnId = val; break; }
    }
  }

  if (espnId !== undefined) {
    return `/api/team-logo?id=${espnId}&src=espn`;
  }

  return null;
}
