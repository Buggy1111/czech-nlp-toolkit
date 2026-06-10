# Czech NLP Toolkit

České NLP nástroje online, zdarma a přímo v prohlížeči. Postaveno na akademických nástrojích [ÚFAL MFF UK](https://ufal.mff.cuni.cz/).

**Web:** https://anonymizace.js.org/

Doprovodný web k MCP serveru [anonymize-mcp](https://github.com/Buggy1111/anonymize-mcp) — pro lidi, kteří nechtějí řešit instalaci ani MCP.

## Nástroje

- **Anonymizace** — skryje osobní údaje (jména, rodná čísla, adresy, telefony, IČO, e-maily) a nahradí je placeholdery (OSOBA1, MESTO1…). Lokální offline mód (regex) i reálný NER. Vlastní stránka `anonymize.html`.
- **NER** — rozpoznávání pojmenovaných entit (NameTag 3).
- **Morfologie** — lemma, slovní druh, mluvnické kategorie (UDPipe 2).
- **Korektor** — oprava překlepů a diakritiky (Korektor).
- **Překlad** — strojový překlad mezi 7 jazyky (CUBBITT).
- **Čitelnost** — *připravujeme* (PONK API zatím nepovoluje volání z prohlížeče / CORS).

## Struktura

Statický web bez build kroku. Tři stránky:

```
index.html          — landing: hák ochrany dat, "pro koho", "jak to funguje",
                      karty nástrojů s prokliky, FAQ
nastroje.html       — interaktivní nástroje: NER, morfologie, korektor, překlad
                      (deep-link přes #hash, např. nastroje.html#morf)
anonymize.html      — plný anonymizér (2 módy, ~19 typů PII, tabulka náhrad)

css/base.css        — sdílené tokeny, layout, header, footer
css/toolkit.css     — styly landingu i stránky nástrojů
css/anonymize.css   — styly anonymizéru
js/extract-text.js  — sdílené čtení PDF/DOCX/TXT (pdf.js + mammoth)
js/toolkit.js       — logika nástrojů + deep-link přes #hash
js/anonymize-engine.js — anonymizační logika
js/anonymize-app.js — DOM vrstva anonymizéru
```

## Jak to funguje

Texty jdou **přímo z prohlížeče** na veřejné akademické API ÚFAL LINDAT
(`https://lindat.mff.cuni.cz/services`). **Žádný vlastní backend, žádný API klíč,
nic se neukládá.** Anonymizér navíc nabízí plně offline lokální mód, kde text
prohlížeč vůbec neopustí. Limit 20 000 znaků na požadavek.

## Vývoj

Žádný build. Stačí libovolný statický server:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

Konvence: ≤ 400 řádků na soubor, čistá separace logiky a DOM, žádný `innerHTML`
(jen DOM metody — XSS bezpečnost).

## Licence

Kód: [PolyForm Noncommercial 1.0.0](LICENSE.md) — volné použití, úpravy i šíření
pro nekomerční účely.

> Required Notice: Copyright Michal Bürgermeister (https://anonymizace.js.org)

NLP engine © ÚFAL MFF UK
([NameTag](https://ufal.mff.cuni.cz/nametag/3) ·
[UDPipe](https://ufal.mff.cuni.cz/udpipe/2) ·
[Korektor](https://ufal.mff.cuni.cz/korektor) ·
[CUBBITT](https://lindat.cz/translation)).
