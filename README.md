# Czech NLP Toolkit

Bezplatná webová sada českých NLP nástrojů — běží **přímo v prohlížeči**, žádný build, žádné závislosti.
Postaveno na akademických nástrojích [ÚFAL MFF UK](https://ufal.mff.cuni.cz/) (LINDAT).

🔗 Web pro lidi, kteří nechtějí řešit MCP servery ani instalaci. Doprovod k MCP serveru
[`anonymize-mcp`](https://github.com/Buggy1111/anonymize-mcp).

## Nástroje

| Nástroj | Engine ÚFAL | Co dělá |
|---|---|---|
| 🔒 Anonymizace | MasKIT / NameTag | skryje PII (jména, RČ, adresy, IČO, e-maily…) — lokální offline mód i reálný NER |
| 🧠 Entity (NER) | NameTag | rozpozná osoby, firmy, místa, instituce, data |
| 📊 Morfologie | UDPipe | lemma, slovní druhy, mluvnické kategorie |
| ✍️ Pravopis | Korektor | opraví překlepy a doplní diakritiku |
| 🌍 Překlad | CUBBITT | překlad mezi 7 jazyky (cs/en/de/fr/pl/ru/uk) |

## Architektura

Statický web, čistá separace (každý soubor ≤ 400 řádků):

```
index.html              hub se všemi nástroji (toolkit)
anonymize.html          plný anonymizér (2 módy, 19 typů PII)
css/
  base.css              sdílené tokeny, layout, hlavička, patička
  toolkit.css           styly toolkitu
  anonymize.css         styly anonymizéru
js/
  extract-text.js       sdílené: soubor → text (PDF/DOCX/TXT)
  toolkit.js            toolkit: API + 4 nástroje + taby
  anonymize-engine.js   čistá logika anonymizace (slovníky, regex pasy, NER)
  anonymize-app.js      DOM vrstva anonymizéru
favicon.svg · og-image.svg · site.webmanifest
robots.txt · sitemap.xml · llms.txt
```

Anonymizér: lokální mód běží zcela offline (zero-egress). NER/ostatní nástroje volají
ÚFAL LINDAT API přímo z prohlížeče (browser-direct, nic se neukládá).

## Provoz

Čistě statické — stačí naservírovat složku:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Licence

Pouze nekomerční použití. Modely ÚFAL jsou pod CC BY-NC-SA, LINDAT API je bezplatné
pro akademické a osobní použití.

Autor: **Michal Bürgermeister** · ✉️ michalbugy12@gmail.com
