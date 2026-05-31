"use strict";
/* anonymize-engine.js — čistá logika anonymizace (žádné DOM).
   Lokální mód: slovníky + regex pasy. NER mód: ÚFAL NameTag (browser-direct). */

const FIRST_NAMES = new Set(["jan","jana","petr","petra","josef","marie","martin","jiří","jiri",
  "tomáš","tomas","pavel","pavla","michal","michaela","lukáš","lukas","jakub","david","ondřej","ondrej",
  "marek","filip","adam","vojtěch","vojtech","matěj","matej","daniel","roman","radek","milan","zdeněk","zdenek",
  "karel","václav","vaclav","františek","frantisek","ladislav","miroslav","stanislav","antonín","antonin",
  "eva","hana","anna","lenka","kateřina","katerina","lucie","veronika","tereza","barbora","markéta","marketa",
  "alena","ivana","monika","zuzana","helena","andrea","martina","dana","simona","nikola","kristýna","kristyna",
  "edita","editka","silvie","jaroslav","vladimír","vladimir","oldřich","oldrich"]);

const CITIES = new Set(["praha","praze","prahy","prahou","prahu","brno","brně","brna","brnu","ostrava","ostravě","ostravy","ostravu","ostravou",
  "plzeň","plzen","plzni","plzně","olomouc","olomouci","olomouce","liberec","liberci","liberce","hradec","hradci","pardubice","pardubic","pardubicích",
  "zlín","zlin","zlíně","zlína","kladno","kladně","kladna","most","mostě","mostu","opava","opavě","opavy","karviná","karvina","karviné","karvinou",
  "jihlava","jihlavě","jihlavy","přerov","prerov","přerově","přerova","studénka","studenka","studénce","studénky","kopřivnice","koprivnice","kopřivnici",
  "odry","oder","odrách","fulnek","fulneku","fulneku","příbor","pribor","příboře","bílovec","bilovec","bílovce","nový jičín","novém jičíně"]);

// pořadí = priorita: specifické (RČ, sp.zn.) PŘED obecným účtem, ať si nepřeberou digits
const STRUCT = [
  {key:"URL",     label:"URL",            re:/\bhttps?:\/\/[^\s<>"]+/gi},
  {key:"EMAIL",   label:"email",          re:/\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g},
  {key:"ULICE",   label:"ulice",          re:/\p{Lu}[\p{Ll}]+(?:ská|cká|ova|ého|ního|í)\s+\d{1,4}(?:\/\d{1,4})?/gu},
  {key:"IBAN",    label:"IBAN",           re:/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}\b/g},
  {key:"KRYPTO",  label:"krypto adresa",  re:/\b(?:0x[a-fA-F0-9]{40}|bc1[a-z0-9]{25,59}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g},
  {key:"TOKEN",   label:"API token",      re:/\b(?:sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35})\b/g},
  {key:"KARTA",   label:"platební karta", re:/\b(?:\d{4}[ -]){3}\d{4}\b/g},
  {key:"RC",      label:"rodné číslo",    re:/\b\d{6}\/\d{3,4}\b/g},
  {key:"SPZN",    label:"spisová značka", re:/\b\d{1,3}\s?[A-Z]{1,3}\s?\d{1,4}\/\d{4}\b/g},
  {key:"SSN",     label:"US SSN",         re:/\b\d{3}-\d{2}-\d{4}\b/g},
  {key:"UCET",    label:"číslo účtu",     re:/\b\d{1,6}-?\d{2,10}\/\d{4}\b/g},
  {key:"DIC",     label:"DIČ",            re:/\b(?:CZ|SK|DE|AT|PL)\d{8,11}\b/g},
  {key:"TELEFON", label:"telefon",        re:/(?:\+420\s?)?\b\d{3}\s?\d{3}\s?\d{3}\b/g},
  {key:"SPZ",     label:"SPZ",            re:/\b\d[A-Z]{1,2}\d?\s?\d{4}\b/g},
  {key:"DATUM",   label:"datum",          re:/\b\d{1,2}\.\s?\d{1,2}\.\s?\d{4}\b/g},
  {key:"PSC",     label:"PSČ",            re:/\b\d{3}\s\d{2}\b/g},
  {key:"ICO",     label:"IČO",            re:/\b\d{8}\b/g},
];

// placeholdery jsou VELKÝMI písmeny + číslo (OSOBA1) → názvové/strukturní
// regexy je znovu nematchnou, takže žádné sentinely nejsou potřeba.
function anonymize(text,nerEnts){
  const reps=[]; const counters={}; const registry=new Map();
  function assign(orig,key,label){
    const k=key+"::"+orig.toLowerCase().replace(/\s+/g," ").trim();
    if(registry.has(k)) return registry.get(k);
    counters[key]=(counters[key]||0)+1;
    const plc=key+counters[key];
    registry.set(k,plc);
    reps.push({original:orig.trim(),placeholder:plc,type:key,label});
    return plc;
  }
  let out=text;
  for(const item of STRUCT) out=out.replace(item.re,m=>assign(m,item.key,item.label));
  // NER entity z NameTagu (reálná jména/firmy/města) — delší texty dřív
  if(nerEnts&&nerEnts.length){
    const uq=[...new Map(nerEnts.map(e=>[e.text,e])).values()].sort((a,b)=>b.text.length-a.text.length);
    for(const e of uq){const x=e.text.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");out=out.replace(new RegExp(x,"g"),m=>assign(m,e.key,e.label));}
  }
  // jména: křestní ze slovníku (i samostatné) NEBO dvojice Velkých slov, kde
  // druhé končí typickou českou příponou příjmení (chytá i skloňované formy
  // jako "Marii Svobodové", které slovník neobsahuje).
  // Jména přes Unicode property escapes (\p{Lu}/\p{Ll} + /u) — řeší diakritiku,
  // kterou JS \b a [a-z] třídy nezvládají. NOTNAME = přídavná jména se stejnou
  // koncovkou jako příjmení (rodné/krajské…), která NEanonymizujeme.
  const NOTNAME=new Set(["rodné","rodného","krajské","krajský","krajského","krajská","krajskému","krajském",
    "městský","městské","městská","městského","okresní","okresního","obvodní","vrchní","vrchního","nejvyšší",
    "ústavní","ústavního","trestní","trestního","občanské","občanský","občanská","občanského","finanční","finančního",
    "sociální","materiální","dobré","dobrý","dobrého","nové","nový","nového","nová","velké","velký","velká",
    "český","česká","české","českého","slovenské","slovenský","slovenská","právní","právního","soudní","soudního",
    "veřejné","veřejný","malá","malé","malý","celá","celé","dlouhá","krásná","správní","daňové","daňový",
    "evropské","evropský","hlavní","hlavního","bytové","bytový","smluvní","kupní","nájemní","příslušné","příslušný",
    "uvedené","uvedený","oprávněná","oprávněný","povinná","povinný","žalovaná","žalovaný","navrhovaná"]);
  // A) křestní ze slovníku + až 2 následující Velká slova (chytá příjmení i bez
  //    jasné přípony: "Petr Svoboda", "Barbora Vidová Hladká")
  // velké počáteční písmeno přímo v alternaci ([Tt]omáš) → NEpoužíváme /i flag,
  // protože /i ruší rozlišení case u \p{Lu}/\p{Ll} a trailing grabber by chytal i malá slova.
  const NAMEALT=[...FIRST_NAMES].sort((a,b)=>b.length-a.length)
    .map(n=>"["+n[0].toUpperCase()+n[0]+"]"+n.slice(1)).join("|");
  // koncová hranice (?![\p{L}]) + volitelná česká skloňovací koncovka → chytí
  // i skloňovaná jména ("Tomáše", "Václavu", "Romana") jako CELÉ slovo, ne kmen.
  const DICT_RE=new RegExp("(?<![\\p{L}])(?:"+NAMEALT+")(?:ovi|em|e|a|u|y|i|ě)?(?![\\p{L}])(?:\\s+\\p{Lu}[\\p{Ll}]+){0,2}","gu");
  out=out.replace(DICT_RE,m=>assign(m,"OSOBA","osoba"));
  // B) anchor na PŘÍJMENÍ (přípona vč. skloňovaných pádů) + volitelné předchozí slovo
  const SUF="(?:ov(?:[áéýaěy]|ou|i)|sk(?:[áéýaěíou]|ého|ému|ém)|ck[áéýaou]|[čďňřšťž]?n(?:[áéýaěiíou]|ého|ou)|[áí]k(?:[aeuyů]|em|ovi)?|ek(?:[aeu]|em|ovi)?|ič(?:e|ovi)?|[ktlrds]á)";
  const SUR_RE=new RegExp("(?:(\\p{Lu}[\\p{Ll}]+)\\s+)?(\\p{Lu}[\\p{Ll}]*"+SUF+")(?![\\p{Ll}])","gu");
  out=out.replace(SUR_RE,function(m,pre,word){const w=word.toLowerCase();return (NOTNAME.has(w)||CITIES.has(w))?m:assign(m,"OSOBA","osoba");});
  // C) samostatná křestní jména ze slovníku
  out=out.replace(/\p{Lu}[\p{Ll}]+/gu,m=>FIRST_NAMES.has(m.toLowerCase())?assign(m,"OSOBA","osoba"):m);
  // D) města (slovník vč. pádů)
  out=out.replace(/\p{Lu}[\p{Ll}]+/gu,m=>CITIES.has(m.toLowerCase())?assign(m,"MESTO","město/obec"):m);
  return {anonymized:out,replacements:reps};
}

// ── Plný NER mód: volá ÚFAL NameTag přímo z prohlížeče (CORS:*) ──
// Browser-direct = traffic z prohlížeče uživatele (rozložené, ÚFAL-friendly).
// NEjde o zero-egress: text odchází na ÚFAL (= default cloud chování MCP).
const NAMETAG_URL="https://lindat.mff.cuni.cz/services/nametag/api/recognize";
// io (instituce/soudy) schválně NEanonymizujeme — zůstanou čitelné (jako MasKIT whitelist)
const NER_MAP={P:["OSOBA","osoba"],"if":["FIRMA","firma"],gu:["MESTO","město/obec"],gc:["MESTO","město/obec"],PER:["OSOBA","osoba"],ORG:["FIRMA","firma"],LOC:["MESTO","město/obec"]};
function parseConll(conll){
  const ents=[]; let cur=null;
  for(const raw of (conll||"").split("\n")){
    const l=raw.replace(/\r$/,"");
    if(!l.trim()){ if(cur){ents.push(cur);cur=null;} continue; }
    const p=l.split("\t"); if(p.length<2){ continue; }
    const tok=p[0], first=p[1].split("|")[0]; // jen nejvnější label (čisté maximální entity)
    if(first==="O"){ if(cur){ents.push(cur);cur=null;} continue; }
    if(first.startsWith("B-")){ if(cur)ents.push(cur); cur={type:first.slice(2),tokens:[tok]}; }
    else if(first.startsWith("I-")){ if(cur)cur.tokens.push(tok); else cur={type:first.slice(2),tokens:[tok]}; }
  }
  if(cur)ents.push(cur);
  for(const e of ents) e.text=e.tokens.join(" ").replace(/\s+([.,;:!?)])/g,"$1").replace(/\s*\.\s*([a-z]{2,4})\b/gi,".$1");
  return ents;
}
async function fetchNER(text){
  const r=await fetch(NAMETAG_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:"data="+encodeURIComponent(text)+"&output=conll"});
  if(!r.ok) throw new Error("NameTag API "+r.status);
  const d=await r.json();
  return parseConll(d.result).filter(e=>NER_MAP[e.type]).map(e=>({text:e.text,key:NER_MAP[e.type][0],label:NER_MAP[e.type][1]}));
}

const TYPE_LABELS={OSOBA:"osoba",FIRMA:"firma",MESTO:"město",ULICE:"ulice",PSC:"PSČ",TELEFON:"telefon",EMAIL:"email",
  URL:"URL",RC:"rodné číslo",ICO:"IČO",DIC:"DIČ",IBAN:"IBAN",UCET:"účet",SPZN:"sp. zn.",DATUM:"datum",
  KRYPTO:"krypto",TOKEN:"API token",KARTA:"karta",SSN:"US SSN",SPZ:"SPZ"};
const PH_RE=/\b(?:OSOBA|FIRMA|MESTO|ULICE|PSC|TELEFON|EMAIL|URL|RC|ICO|DIC|IBAN|UCET|SPZN|DATUM|KRYPTO|TOKEN|KARTA|SSN|SPZ)\d+\b/g;
