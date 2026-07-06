import { superbetAjax } from "./src/services/superbetClient";

async function countUo(params: Record<string,string>) {
  const j = await superbetAjax<{ odds?: Record<string, Record<string, unknown>>; selected_tab?: string }>(params);
  const ext = j?.result?.odds ? Object.keys(j.result.odds)[0] : "";
  const keys = ext && j?.result?.odds ? Object.keys(j.result.odds[ext]) : [];
  const uo = keys.filter(k => k.includes("_uo")).length;
  return { ok: j?.errorCode, tab: j?.result?.selected_tab, uo, total: keys.length, sample: keys.slice(0,2).join(",") };
}

async function main() {
  const base = { action: "events", idchampionship: "222763", discipline: "1", id_evento: "196843047" };
  const tries: Record<string,string>[] = [
    { ...base, selected_tab: "O/U_soccer" },
    { ...base, tabSelected: "O/U_soccer" },
    { ...base, tab_key: "O/U_soccer" },
    { ...base, key_tab: "O/U_soccer" },
    { ...base, id_tab: "2" },
    { ...base, idgroup: "2" },
    { ...base, id_group: "2" },
    { ...base, order_group: "10" },
    { ...base, group_id: "2" },
    { ...base, idTab: "2" },
    { ...base, tabId: "2" },
    { action: "getOdds", id_evento: "196843047", discipline: "1", idchampionship: "222763", selected_tab: "O/U_soccer" },
    { action: "loadOdds", id_evento: "196843047", discipline: "1", idchampionship: "222763", selected_tab: "O/U_soccer" },
    { action: "eventOdds", id_evento: "196843047", discipline: "1", idchampionship: "222763", selected_tab: "O/U_soccer" },
    { action: "events", idchampionship: "222763", discipline: "1", id_evento: "196843047", extCode: "521657", selected_tab: "O/U_soccer" },
    { action: "events", idchampionship: "222763", discipline: "1", id_evento: "196843047", extCode: "521657", tab: "2" },
    { action: "events", idchampionship: "222763", discipline: "1", id_evento: "196843047", extCode: "521657", id_palinsesto: "2225", selected_tab: "O/U_soccer" },
    { action: "events", idchampionship: "222763", discipline: "1", id_evento: "196843047", extCode: "521657", champ_play: "3", selected_tab: "O/U_soccer" },
    { action: "events", idchampionship: "222763", discipline: "1", id_evento: "196843047", extCode: "521657", header_alternative: "0", selected_tab: "O/U_soccer" },
    { action: "events", idchampionship: "222763", discipline: "1", id_evento: "196843047", extCode: "521657", all: "1", selected_tab: "O/U_soccer" },
  ];
  for (const p of tries) {
    const r = await countUo(p);
    const extra = Object.entries(p).filter(([k]) => !["action","idchampionship","discipline","id_evento"].includes(k)).map(([k,v])=>`${k}=${v}`).join(" ");
    console.log(extra || "(base only)", "=>", JSON.stringify(r));
  }
}
main();
