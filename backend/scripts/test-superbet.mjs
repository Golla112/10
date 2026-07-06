function parseCookies(setCookies) {
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}

async function bootstrap() {
  const res = await fetch('https://superbet24.org/index.php?action=sport', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  const html = await res.text();
  const csrf = html.match(/meta name="csrf-token" content="([^"]+)"/i)?.[1];
  const cookie = parseCookies(res.headers.getSetCookie?.() ?? []);
  return { csrf, cookie };
}

async function ajax(cookie, csrf, params) {
  const body = new URLSearchParams({ sesstkn: '', ...params });
  const res = await fetch('https://superbet24.org/ajax.php', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://superbet24.org',
      Referer: 'https://superbet24.org/index.php?action=sport',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-Token': csrf ?? '',
      Cookie: cookie,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: body.toString(),
  });
  const text = await res.text();
  if (!text.startsWith('{')) {
    console.log('ajax error', params.action, text.slice(0, 80));
    return null;
  }
  return JSON.parse(text);
}

const { csrf, cookie } = await bootstrap();
console.log('bootstrapped csrf', csrf?.slice(0, 16), 'cookie len', cookie.length);

const print = await ajax(cookie, csrf, { action: 'oddsPrint', iddiscipline: '1', all: '1' });
const groups = print?.result?.championshipGroups ?? [];
let championships = 0;
for (const g of groups) championships += (g.championships ?? []).length;
console.log('championship groups', groups.length, 'championships', championships);

const elite = [];
for (const g of groups) {
  for (const c of g.championships ?? []) {
    if (c.elite === 1) elite.push(c);
  }
}
console.log('elite championships', elite.length, elite.slice(0, 3).map((c) => c.descrizione));

if (elite[0]) {
  const ev = await ajax(cookie, csrf, {
    action: 'events',
    idchampionship: String(elite[0].id_campionato),
    discipline: String(elite[0].id_disciplina),
  });
  const list = ev?.result?.events?.result ?? [];
  console.log('events for', elite[0].descrizione, list.length);
  if (list[0]) {
    const ext = list[0].extCode;
    const o = ev?.result?.odds?.[ext];
    console.log('sample odds', o?.['1_1x2:1']?.valore, o?.['1_1x2:Draw']?.valore, o?.['1_1x2:2']?.valore);
  }
}
