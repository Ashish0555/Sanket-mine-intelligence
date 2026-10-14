"""Rebuild the local SANKET retrieval model; no API key or remote upload needed."""
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from pypdf import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer, ENGLISH_STOP_WORDS
from sklearn.decomposition import TruncatedSVD
from sklearn.preprocessing import normalize

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data'
OUT.mkdir(exist_ok=True)
stop = sorted(set(ENGLISH_STOP_WORDS) | {'shall','said','person','persons','year','years','mine','mines','mining','accident','accidents','sanket'})
stopset = set(stop)
def clean(s):
    return re.sub(r'\s+', ' ', s).strip()
def tokens(s):
    return [w for w in re.findall(r'[a-z][a-z0-9]{1,}', s.lower()) if w not in stopset]
def dump(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')))

raw = json.loads((ROOT / 'inputs/accident-cases.json').read_text())
prior = json.loads((ROOT / 'inputs/fire-register.json').read_text())
fires = {x['id']: x for x in prior['incidents'] if x['inclusion'] == 'Core'}
docs = []
catalog = []
for r in raw:
    year = 2000 + int(r['date'].split('.')[-1])
    ident = f"{'C' if r['sector']=='Coal' else 'N'}-{year}-{r['case_no']:02d}"
    f = fires.get(ident)
    sector = 'coal' if r['sector'] == 'Coal' else 'noncoal'
    d = dict(id=ident, kind='case', sector=sector, title=r['mine'].title(),
             year=year, date=r['date'], state=r['state'], category=r['original_label'],
             page=r['pdf_page'], endPage=r['end_pdf_page'], printedPage=r['printed_page'],
             text=clean(r['narrative']), event=clean(r['event']),
             fire=bool(f), scenario=f['scenario'] if f else '',
             summary=f['event_plain'] if f else '', inquiry=f['inquiry_plain'] if f else '',
             action=f['proposed_action'] if f else '', deaths=f['fatalities'] if f else None)
    # Entire case with inquiry remains one unit, preserving prevention context.
    docs.append(d)
    catalog.append({k:v for k,v in d.items() if k not in ['text','inquiry','action']})

books=[]
for sector, fname, title in [('coal','SANKET_Coal.pdf','SANKET · Coal'),('noncoal','SANKET_NonCoal.pdf','SANKET · Non-coal')]:
    p = ROOT / 'public/sources' / fname
    reader = PdfReader(p)
    usable = 0
    short = []
    for number, page in enumerate(reader.pages, 1):
        txt = page.extract_text() or ''
        txt = re.sub(r'Statistical Analysis\s*&\s*Numbers:\s*Key Evaluation of Trends in (?:Non-Coal|Coal) Mine Accidents','',txt,flags=re.I)
        txt = re.sub(r'(?m)^\s*(?:\d+|SANKET|[-_]{4,})\s*$', '', txt)
        txt = clean(txt)
        if len(txt) < 80:
            short.append(number)
            continue
        usable += 1
        words=txt.split()
        for part, start in enumerate(range(0, len(words), 300)):
            segment=' '.join(words[max(0,start-45):start+345])
            if len(segment)<80: continue
            docs.append(dict(id=f'{sector}-p{number}-{part}',kind='page',sector=sector,title=f'{title} · page {number}',page=number,endPage=number,printedPage=number-14 if number>14 else None,text=segment,event='',category='Book passage',fire=False))
    books.append(dict(id=sector,title=title,filename=fname,pages=len(reader.pages),indexedPages=usable,shortPages=short,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))

texts=[' '.join(tokens(' '.join(str(d.get(k,'')) for k in ['title','category','scenario','text','inquiry']))) for d in docs]
vectorizer=TfidfVectorizer(token_pattern=r'(?u)\b\w+\b',max_features=6000,min_df=2,max_df=.95,sublinear_tf=True,dtype=np.float32)
X=vectorizer.fit_transform(texts)
svd=TruncatedSVD(n_components=64,random_state=42,n_iter=7)
emb=normalize(svd.fit_transform(X))
vocab=vectorizer.get_feature_names_out().tolist()
post=defaultdict(list)
lengths=[]
for i, text in enumerate(texts):
    words=text.split(); lengths.append(len(words))
    for term, tf in Counter(words).items(): post[term].extend([i,tf])
model=dict(version=1,method='BM25 + TF-IDF/LSA (64 dimensions)',stopwords=stop,
           vocabulary=vocab,idf=np.round(vectorizer.idf_,6).tolist(),
           # Term-major projection makes a sparse query transform cheap.
           projection=np.round(svd.components_.T,5).tolist(),vectors=np.round(emb,5).tolist(),
           postings=dict(post),lengths=lengths,averageLength=round(float(np.mean(lengths)),4))
manifest=dict(books=books,pages=sum(x['pages'] for x in books),indexedPages=sum(x['indexedPages'] for x in books),
              chunks=len(docs),cases=len(raw),fireCases=len(fires),fireDeaths=sum(x['fatalities'] for x in fires.values()),
              method=model['method'],dimensions=64,vocabulary=len(vocab),
              scope='All readable text in both supplied books; 622 structured 2016–2022 cases, including their inquiry findings. 14 confirmed fire cases form the fire briefing subset.',
              limitations=['Historical accident reports, not a current mine inspection or a current regulation register.','Scanned cover/short pages are listed in the ingestion manifest; numerical tables can lose layout during PDF extraction.','The retrieval model is fitted to these documents; a separately configured language model generates grounded answers.','Retrieval scores are similarity signals, not probabilities of fire or factual correctness.'],
              explainedVariance=round(float(svd.explained_variance_ratio_.sum()),4))
dump('documents.json',docs);dump('retrieval-model.json',model);dump('catalog.json',catalog);dump('manifest.json',manifest)
print(json.dumps(manifest,indent=2))
