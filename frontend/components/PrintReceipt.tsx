'use client';
import Image from 'next/image';
import { StoredBet } from './BetConfirmation';

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtEuro(n: number) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > arr.length) return [];
  const [first, ...rest] = arr;
  return [...combinations(rest, k - 1).map(c => [first, ...c]), ...combinations(rest, k)];
}

interface PrintReceiptProps {
  bet: StoredBet;
  paymentMode?: boolean;
  paidAt?: string;
}

export default function PrintReceipt({ bet, paymentMode = false, paidAt }: PrintReceiptProps) {
  const sistemaInfo = bet.sistema_info;
  const isSistema = !!sistemaInfo || bet.tipo_schedina?.startsWith('sistema_');
  const isMultipla = !isSistema && bet.selections.length > 1;
  const tipoLabel = isSistema && sistemaInfo
    ? `SISTEMA ${sistemaInfo.k}/${sistemaInfo.n}`
    : isMultipla ? 'MULTIPLA' : 'SINGOLA';

  const baseWin = parseFloat((bet.stake * bet.total_odds).toFixed(2));
  const bonus = !isSistema && bet.bonus_pct != null && bet.bonus_pct > 0
    ? parseFloat((baseWin * bet.bonus_pct / 100).toFixed(2))
    : 0;

  const sistemaCombos = isSistema && sistemaInfo
    ? combinations(bet.selections, sistemaInfo.k)
    : null;

  return (
    <>
      <style>{`
        #rcp { font-family:'Courier New',Courier,monospace; font-size:11px; line-height:1.5; color:#000; background:#fff; width:302px; max-width:100%; margin:0 auto; padding:12px 10px 16px; box-shadow:0 2px 12px rgba(0,0,0,0.15); }
        #rcp .r-logo { text-align:center; margin-bottom:6px; }
        #rcp .r-sep { border:none; border-top:1px dashed #000; margin:6px 0; }
        #rcp .r-row { display:flex; justify-content:space-between; font-size:10px; margin:2px 0; }
        #rcp .r-row .lbl { color:#333; }
        #rcp .r-row .val { font-weight:bold; }
        #rcp .r-sel { margin:4px 0; }
        #rcp .r-sel-ev { font-weight:bold; font-size:11px; }
        #rcp .r-sel-mkt { display:flex; justify-content:space-between; font-size:10px; margin-top:2px; }
        #rcp .r-sel-mkt .mkt { color:#333; flex:1; }
        #rcp .r-sel-mkt .out { font-weight:bold; flex:1; text-align:center; }
        #rcp .r-sel-mkt .qt { font-weight:bold; text-align:right; }
        #rcp .r-combo { margin:4px 0; border:1px dashed #999; padding:3px 5px; }
        #rcp .r-combo-hdr { font-size:9px; font-weight:bold; color:#555; margin-bottom:2px; }
        #rcp .r-combo-row { font-size:9px; display:flex; justify-content:space-between; }
        #rcp .r-totals { margin:4px 0; }
        #rcp .r-box { border:1px solid #000; padding:4px 6px; margin:6px 0; text-align:center; }
        #rcp .r-box-lbl { font-size:9px; font-weight:bold; letter-spacing:1px; }
        #rcp .r-box-val { font-size:14px; font-weight:bold; letter-spacing:2px; }
        #rcp .r-footer { margin-top:10px; font-size:8px; color:#333; text-align:center; line-height:1.4; }
        #rcp .r-footer-title { font-weight:bold; font-size:9px; margin-bottom:2px; }
        #rcp .r-footer-sub { font-style:italic; margin-bottom:4px; }
      `}</style>

      <div id="rcp">
        <div className="r-logo">
          <Image src="/logo-2.png" alt="BigBet365" width={180} height={60}
            style={{ objectFit: 'contain', maxWidth: '100%' }} priority />
        </div>
        <hr className="r-sep" />

        <div className="r-row">
          <span className="lbl">{fmtDate(bet.created_at)}</span>
          <span className="val">ID: {bet.codice_schedina}</span>
        </div>
        <div className="r-row">
          <span className="lbl">Giocatore: {bet.nome_proprietario || 'Anonimo'}</span>
          <span className="val">{tipoLabel}</span>
        </div>
        <hr className="r-sep" />

        {/* Selezioni */}
        {bet.selections.map((sel, i) => (
          <div key={sel.event_id + i} className="r-sel">
            <div className="r-sel-ev">{i + 1}. {sel.nome_evento}</div>
            <div className="r-sel-mkt">
              <span className="mkt">{sel.market}</span>
              <span className="out">{sel.outcome}</span>
              <span className="qt">{sel.quota.toFixed(2)}</span>
            </div>
          </div>
        ))}
        <hr className="r-sep" />

        {/* Combinazioni sistema */}
        {isSistema && sistemaInfo && sistemaCombos && (
          <>
            <div className="r-row">
              <span className="lbl">Combinazioni</span>
              <span className="val">{sistemaInfo.num_combinations}</span>
            </div>
            <div className="r-row">
              <span className="lbl">Puntata per combo</span>
              <span className="val">€ {fmtEuro(sistemaInfo.stake_per_combo)}</span>
            </div>
            <hr className="r-sep" />
            {sistemaCombos.map((combo, ci) => {
              const comboOdds = combo.reduce((acc, s) => acc * s.quota, 1);
              const comboWin = sistemaInfo.stake_per_combo * comboOdds;
              return (
                <div key={ci} className="r-combo">
                  <div className="r-combo-hdr">
                    Combo {ci + 1} — Q: {comboOdds.toFixed(2)} — Max: € {fmtEuro(comboWin)}
                  </div>
                  {combo.map((sel, si) => (
                    <div key={si} className="r-combo-row">
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sel.nome_evento}
                      </span>
                      <span style={{ marginLeft: 4, fontWeight: 'bold' }}>
                        {sel.outcome} {sel.quota.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
            <hr className="r-sep" />
          </>
        )}

        {/* Importo */}
        <div className="r-totals">
          <div className="r-row">
            <span className="lbl">Importo totale</span>
            <span className="val">€ {fmtEuro(bet.stake)}</span>
          </div>
          {!isSistema && (
            <div className="r-row">
              <span className="lbl">QUOTA</span>
              <span className="val">{bet.total_odds.toFixed(2)}</span>
            </div>
          )}
        </div>

        {!isSistema && bonus > 0 && (
          <div className="r-box">
            <div className="r-box-lbl">BONUS</div>
            <div className="r-box-val">{'///'} € {fmtEuro(bonus)} {'////'}</div>
          </div>
        )}

        <div className="r-box">
          <div className="r-box-lbl">
            {paymentMode ? 'VINCITA PAGATA' : isSistema ? 'VINCITA MAX (tutte vincenti)' : 'VINCITA POT.'}
          </div>
          <div className="r-box-val">{'////'} € {fmtEuro(bet.potential_win)} {'////'}</div>
          {paymentMode && paidAt && (
            <div style={{ fontSize: 9, marginTop: 2 }}>Pagato il {fmtDate(paidAt)}</div>
          )}
        </div>

        <div className="r-footer">
          <div className="r-footer-title">SCOMMETTERE È SEVERAMENTE VIETATO AI MINORI DI 18 ANNI</div>
          <div className="r-footer-sub">IL GIOCO PUÒ CREARE DIPENDENZA PATOLOGICA</div>
          <div>
            La presente ricevuta è solo un promemoria della scommessa effettuata nel proprio
            calo gioco e non ha nessun valore ai fini di riscossione in nessun caso di vincita.
            La vincita potenziale riportata sulla ricevuta è da intendersi puramente indicativa.
          </div>
        </div>
      </div>
    </>
  );
}
