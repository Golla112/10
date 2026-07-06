
import { OddsApiBookmaker, OddsApiMarket } from './betStackService';

const SOFASCORE_BASE = 'https://api.sofascore.com/api/v1';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.sofascore.com/',
  'Origin': 'https://www.sofascore.com',
};

/**
 * Fetcha le quote reali 1X2 da Sofascore per un evento specifico.
 */
export async function fetchSofa1x2Odds(sofaId: number): Promise<OddsApiBookmaker | null> {
  try {
    // Proviamo l'endpoint odds per il provider 1 (solitamente Bet365 o principale)
    const url = `${SOFASCORE_BASE}/event/${sofaId}/odds/1/all`;
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
    
    if (!res.ok) {
        // Se non trova nulla, proviamo featured-odds
        const resFeatured = await fetch(`${SOFASCORE_BASE}/event/${sofaId}/featured-odds/1/all`, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
        if (!resFeatured.ok) return null;
        return parseSofaOdds(await resFeatured.json());
    }

    const data = await res.json();
    return parseSofaOdds(data);
  } catch (err) {
    console.warn(`[sofascore-odds] Error fetching odds for ${sofaId}:`, err);
    return null;
  }
}

function parseSofaOdds(data: any): OddsApiBookmaker | null {
  if (!data || !data.markets || !Array.isArray(data.markets)) return null;

  // structureType: 1 è tipicamente 1X2 per calcio, hockey, ecc.
  // structureType: 2 potrebbe essere H2H per basket/tennis (senza pareggio)
  const h2hMarket = data.markets.find((m: any) => m.structureType === 1 || m.structureType === 2);
  if (!h2hMarket || !h2hMarket.choices || !Array.isArray(h2hMarket.choices)) return null;

  const outcomes = h2hMarket.choices.map((c: any) => {
    let name = c.name;
    // Normalizza i nomi esito tipici
    if (name === '1') name = 'home';
    if (name === 'X') name = 'Draw';
    if (name === '2') name = 'away';
    
    return {
      name: name,
      price: parseFloat(c.fractionalValue.split('/').reduce((a: any, b: any) => (parseInt(a)/parseInt(b) + 1).toFixed(2))),
      // Se c'è decimalValue usiamolo direttamente (stringa tipo "1.80")
      ...(c.decimalValue ? { price: parseFloat(String(c.decimalValue)) } : {})
    };
  });

  const finalMarket: OddsApiMarket = {
    key: 'h2h',
    outcomes: outcomes
  };

  return {
    key: 'sofascore_real',
    title: 'Sofascore Prematch',
    markets: [finalMarket]
  };
}
