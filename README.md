# englishvoca

신문 한 부 펼쳐보듯 단어를 외우는 영어 단어장.

## 컨셉

- **읽는 단어장.** Medium의 활자 미감 + 신문의 정리된 레이아웃.
- **클래식 세리프.** Garamond 계열로 본문, 헤드라인은 큼직하게.
- **API 결제 0원.** 핵심 단어 데이터는 정적 JSON, 부가 정보는 Free Dictionary API(무료, 키 불필요).

## 모드

- **암기 (Study)** — 카드 뒤집기, 예문/발음 노출.
- **테스트 (Quiz)** — 객관식·주관식, 오답만 다시.
- **진도** — LocalStorage에 정답률·복습 주기 저장.

## 개발

```bash
npm install
npm run dev      # Vite dev server
npm run build    # 정적 빌드
```

## 데이터 출처

- 정적: `data/words.json` (직접 큐레이션)
- 동적: https://api.dictionaryapi.dev/api/v2/entries/en/<word>
- 발음: 브라우저 내장 Web Speech API
