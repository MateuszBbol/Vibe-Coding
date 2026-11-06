# DESIGN.md — Home

System projektowy aplikacji **Home**: wspólne zakupy, zadania i przepisy dla grupy (rodziny,
współlokatorów). Aplikacja jest napisana w Expo / React Native i działa jako PWA w przeglądarce
oraz jako aplikacja mobilna. Projektujemy najpierw na telefon (ok. 390 px szerokości), jedną ręką.

Źródła prawdy w kodzie:
- tokeny: `src/constants/theme.ts`;
- nagłówek: `src/components/ScreenHeader.tsx`;
- dolna nawigacja: `src/components/AppBottomNav.tsx`;
- teksty: `src/localization/index.ts`.

---

## 1. Zasady

1. **Spokój i czytelność.** Ciepłe, przygaszone tła, jeden zielony akcent, mało ozdobników. Ekran
   ma się dać zrozumieć w sekundę, np. stojąc w sklepie.
2. **Ikony zamiast tekstu na przyciskach akcji.** Edycja, usuwanie, zatwierdzenie i anulowanie to
   ikony (ołówek, kosz, ✓, ✕). Etykietę zawsze dajemy w `accessibilityLabel`.
3. **Wyśrodkowanie.** Tytuły ekranów, nagłówki sekcji, komunikaty o pustym stanie oraz pary ✓ / ✕
   wyśrodkowujemy w poziomie.
4. **Bez zbędnych znaków.** Żadnych „+” w etykietach przycisków („Nowa lista”, „Dodaj punkt”),
   żadnych liczników w nagłówkach sekcji, żadnych strzałek (chevronów) w wierszach list.
5. **Pola opcjonalne nic nie wymuszają.** Data zadania, wykonawca, jednostka i składniki kroku są
   opcjonalne. Domyślnie nic nie jest zaznaczone, a ponowne kliknięcie odznacza.
6. **Nic nie powiększa się samo na iOS.** Każde pole tekstowe ma `fontSize` co najmniej **16**.

---

## 2. Kolory

Tryb jasny i ciemny dopasowuje się automatycznie (`userInterfaceStyle: automatic`). W komponentach
kolory zawsze bierzemy z `Colors[dark ? 'dark' : 'light']`; nie wpisujemy wartości hex na sztywno,
poza kolorami stanów z tabeli niżej.

| Token           | Jasny     | Ciemny    | Zastosowanie                                               |
| --------------- | --------- | --------- | ---------------------------------------------------------- |
| `background`    | `#F7F7F2` | `#151915` | tło ekranu, tło pól tekstowych i niezaznaczonych chipów    |
| `card`          | `#FFFFFF` | `#202620` | karty, przyciski drugorzędne, okrągły przycisk Wstecz      |
| `text`          | `#20231F` | `#F2F4EE` | tekst główny                                               |
| `secondaryText` | `#656B61` | `#B5BDB3` | podpisy, etykiety pól, ilości, ukończone pozycje           |
| `border`        | `#E4E6DD` | `#343C34` | obramowania kart, pól i chipów                             |
| `accent`        | `#427A55` | `#91C99B` | akcja główna, aktywna zakładka, ikony, zaznaczenie         |
| `accentSoft`    | `#E7F0E7` | `#27372A` | tło zaznaczonego chipa i aktywnej ikony w nawigacji        |

Kolory stanów (stałe w obu trybach):

| Kolor     | Zastosowanie                                                      |
| --------- | ----------------------------------------------------------------- |
| `#B42318` | błędy, akcje destrukcyjne (Usuń przepis, Usuń listę, kosz)        |
| `#B54708` | termin zadania: zaległe / dzisiaj                                 |
| `#8C9386` | linia pod nagłówkiem ekranu                                       |
| `#0B4426` | tło ikony aplikacji i ekranu startowego                           |

Na akcencie piszemy tekstem w kolorze `#FFFFFF` (jasny) albo `#151915` (ciemny).

---

## 3. Typografia

Domyślnie używamy fontu systemowego. Na webie stos fontów to `Spline Sans, Inter, system-ui`
(`src/global.css`).

| Rola                         | Rozmiar  | Grubość | Uwagi                                     |
| ---------------------------- | -------- | ------- | ----------------------------------------- |
| Tytuł aplikacji „Home”       | 28       | 700     | ekran główny, z ikoną domku               |
| Tytuł ekranu                 | 24 / 26  | 700     | `ScreenHeader`, wyśrodkowany, max 2 linie |
| Nagłówek sekcji              | 18–20    | 700     | „Dzisiaj”, „Później”, „Składniki”         |
| Tekst pozycji / przycisku    | 16–17    | 600–700 | nazwa produktu, zadania, kroku            |
| Pole tekstowe                | **16**   | 400     | minimum, by iOS nie powiększał ekranu     |
| Tekst pomocniczy             | 14–15    | 400–600 | ilości, opisy, komunikaty                 |
| Etykieta pola / małe podpisy | 12–13    | 600     | „Data”, „Wykonawca”, etykiety w nawigacji |

Interlinia wynosi ok. 1,2× rozmiaru dla tytułów i ok. 1,45× dla tekstu ciągłego (np. 15/22).

---

## 4. Odstępy, zaokrąglenia, rozmiary

Skala odstępów (`Spacing`): `half 2 · one 4 · two 8 · three 16 · four 24 · five 32 · six 64`.

- Margines ekranu i odstęp między kartami: **16** (`three`). Na dole przewijanej treści: **32**.
- Odstęp wewnątrz karty: **8**.
- Szerokość treści na dużych ekranach: max **560 px**, wyśrodkowana.

| Element                          | Zaokrąglenie |
| -------------------------------- | ------------ |
| Karta                            | 16           |
| Przycisk, pole tekstowe          | 12           |
| Chip (jednostka, składnik, osoba)| 10–14        |
| Okrągły przycisk Wstecz          | 22 (koło 44) |
| Pigułka ikony w nawigacji        | 15 (56×30)   |
| Checkbox zadania                 | koło         |

Cele dotyku mają minimum **44×44**. Przyciski mają wysokość 48, a pozycje nawigacji 56.
Obramowania mają grubość 1 px, linie podziału `hairlineWidth`.

---

## 5. Układ ekranu

```
┌─────────────────────────────────┐
│ (←)        Tytuł ekranu     [⋯] │  ScreenHeader, min. 56, linia #8C9386
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │ Karta                     │  │  ScrollView, padding 16, gap 16
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Karta                     │  │
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│  📖      🛒      ☑       ▤      │  AppBottomNav (tylko ekrany sekcji)
│ Przepisy Zakupy Zadania Grupy   │
└─────────────────────────────────┘
```

- **Ekrany sekcji** (Przepisy, Zakupy, Zadania, Grupy) mają dolną nawigację i nie mają przycisku
  Wstecz.
- **Ekrany szczegółów** (szczegóły grupy, formularze) mają okrągły przycisk Wstecz (ikona strzałki,
  bez słowa „Wstecz”). Na stronie przepisu i w trybie „Przyrządź” zostaje dolna nawigacja.
- Lewa i prawa strefa nagłówka mają po 76 px, dzięki czemu tytuł zawsze jest na środku.
- Dolna nawigacja jest zawsze przypięta do dołu, także w poziomie i na desktopie.

### Dolna nawigacja

Kolejność: **Przepisy · Zakupy · Zadania · Grupy**. Po starcie otwierają się **Zadania**.

| Sekcja   | iOS (SF Symbols)        | Android / web (Material) |
| -------- | ----------------------- | ------------------------ |
| Przepisy | `book.closed`           | `menu_book`              |
| Zakupy   | `cart`                  | `shopping_cart`          |
| Zadania  | `checklist`             | `checklist`              |
| Grupy    | `list.bullet.rectangle` | `list_alt`               |

Aktywna pozycja ma ikonę w pigułce `accentSoft`, kolor `accent` i etykietę o grubości 700.
Nieaktywne pozycje mają kolor `secondaryText` i grubość 500.

---

## 6. Komponenty

### Karta
Tło `card`, obramowanie `border` 1 px, zaokrąglenie 16, padding 16, odstęp 8. Każdy formularz
dodawania (zadanie, produkt) jest osobną kartą nad sekcjami z listą.

### Przyciski
- **Główny:** tło `accent`, tekst w kolorze kontrastowym, wysokość 48, zaokrąglenie 12,
  tekst 16/700.
- **Drugorzędny:** tło `card`, obramowanie `border`, tekst `text`.
- **Destrukcyjny:** tekst i obramowanie `#B42318`. Usuwanie zawsze wymaga potwierdzenia (na webie
  przez `confirmRecipeAction`, bo `Alert.alert` tam nie działa). Usunięcie grupy wymaga dodatkowo
  przepisania jej nazwy.
- **Duża ikona akcji** (strona przepisu): kafel o wysokości co najmniej 64, z ikoną i krótkim
  podpisem pod spodem, ustawiony w jednym rzędzie. Kolejność: Przyrządź, Do zakupów, Edytuj, Usuń.
- **Ikona w wierszu:** 44×44, bez tła. Ołówek służy do edycji, a kosz do usuwania; przy
  „Kupione” kosz czyści całą listę.

### Pola tekstowe
Tło `background`, obramowanie `border`, zaokrąglenie 12, wysokość co najmniej 44, tekst 16.
Etykieta pola jest nad polem, w rozmiarze 12–13/600 i kolorze `secondaryText`. Błąd wyświetlamy
pod polem w kolorze `#B42318`, w rozmiarze 14.

### Chipy wyboru
Służą do wyboru jednostki, osoby (wykonawcy) i składników kroku.
- Niezaznaczony: tło `background`, obramowanie `border`, tekst `text`.
- Zaznaczony: tło `accentSoft`, obramowanie i tekst `accent`, opcjonalny prefiks „✓ ”.
- Ponowne kliknięcie odznacza chip. Na webie ustawiamy `aria-checked`, bo RNW nie przekazuje
  `accessibilityState`.
- Wykonawca: chipy z inicjałem; na początku jest „Ja”, na końcu „Wszyscy”, który zaznacza wszystkie
  osoby, a ponownie kliknięty je odznacza.

### Wiersz listy (produkt / zadanie)
- Po lewej checkbox: okrągły dla zadań, kwadratowy dla produktów. W trybie edycji checkbox znika.
- Po prawej ilość lub termin, a potem ikona edycji. Pozycje ukończone i kupione są przekreślone,
  w kolorze `secondaryText` i bez możliwości edycji.
- Edycja odbywa się w miejscu wiersza. Pola są wyśrodkowane, a para ✓ / ✕ jest wyśrodkowana pod
  nimi.

### Sekcje list
- Zakupy: sekcja „Lista zakupów” i zwijana sekcja „Kupione”.
- Zadania: sekcje „Dzisiaj” (zaległe i dzisiejsze), „Później” (przyszłe i bez terminu) oraz
  zwijana sekcja „Zrobione”.
- Nagłówki sekcji są wyśrodkowane i nie mają liczników.

### Pusty stan
Krótkie zdanie w rozmiarze 15/22, kolorze `secondaryText`, wyśrodkowane, z paddingiem 16.

### Tryb „Przyrządź”
- Na górze jest zwijana karta „Składniki”. Pod nią lista kroków z pełnym tekstem i checkboxem
  po prawej.
- Pod treścią kroku są jego składniki („• Mąka … 1 kg”, 15 / 14 `secondaryText`).
- Krok z czasem ma minutnik (start, pauza, reset).
- U góry jest pasek postępu „1 z 3”. Postęp jest zapisywany na urządzeniu, a ekran nie gaśnie.
- Po ukończeniu wszystkich kroków pojawia się komunikat „Smacznego!” i przycisk „Wróć do
  przepisu”, który zeruje kroki.

---

## 7. Ikony

Używamy `SymbolView` z `expo-symbols`, podając nazwę dla każdej platformy:
`{ ios: <SF Symbol>, android: <Material>, web: <Material> }`.

| Znaczenie         | iOS                          | Material             |
| ----------------- | ---------------------------- | -------------------- |
| Wstecz            | `chevron.left`               | `arrow_back`         |
| Edytuj            | `pencil`                     | `edit`               |
| Usuń              | `trash`                      | `delete_outline`     |
| Zatwierdź / Anuluj| `checkmark` / `xmark`        | `check` / `close`    |
| Data              | `calendar`                   | `calendar_today`     |
| Przyrządź         | `frying.pan`                 | `skillet`            |
| Do zakupów        | `cart.badge.plus`            | `add_shopping_cart`  |
| Użytkownik        | `person.crop.circle`         | `account_circle`     |
| Wyloguj           | `rectangle.portrait.and.arrow.right` | `logout`     |
| Minutnik          | `play.fill` / `pause.fill` / `arrow.counterclockwise` | `play_arrow` / `pause` / `restart_alt` |
| Ekran główny      | `house`                      | `home`               |

Rozmiar ikony to 22–24 w przyciskach i ok. 28 w dużych kaflach. Kolor to `accent`, a przy
akcjach destrukcyjnych `#B42318`.

---

## 8. Język i teksty

- Interfejs jest po polsku (z angielskim tłumaczeniem w `localization`). Teksty są krótkie, bez
  kropek w etykietach.
- Pojemnik na wspólne dane nazywamy **„Grupa” / „Grupy”** („Moje grupy”, „Nowa grupa”).
- Zamiast „Właściciel” pokazujemy imię twórcy.
- Kod zaproszenia jest krótki i czytelny, np. `K7M2-P9QR`.
- Komunikaty błędów mówią, co zrobić, a nie co się zepsuło technicznie.

---

## 9. Dostępność

- Każdy przycisk z samą ikoną ma `accessibilityLabel`. Nagłówki ekranów mają
  `accessibilityRole="header"`.
- Checkboxy i chipy mają `accessibilityRole="checkbox"` i ustawiony stan; na webie dodatkowo
  `aria-checked` / `aria-selected`.
- Kontrast tekstu `secondaryText` na `background` spełnia WCAG AA dla tekstu 14 px i większego.
- Nie polegamy wyłącznie na kolorze: ukończone pozycje są też przekreślone, a zaznaczone chipy
  mają „✓”.

---

## 10. Lista kontrolna nowego ekranu

- [ ] Kolory pochodzą z `Colors`, odstępy ze `Spacing`.
- [ ] Tytuł jest wyśrodkowany w `ScreenHeader`; ekran sekcji ma dolną nawigację, a szczegóły mają
      okrągły przycisk Wstecz.
- [ ] Pola tekstowe mają rozmiar co najmniej 16, a cele dotyku co najmniej 44×44.
- [ ] Akcje wierszy są ikonami z `accessibilityLabel`; usuwanie wymaga potwierdzenia.
- [ ] Pusty stan jest wyśrodkowany; nagłówki sekcji nie mają liczników ani „+”.
- [ ] Ekran wygląda dobrze w trybie ciemnym, w poziomie i na szerokim ekranie (max 560 px).
