# Nasze Zakupy

Polska aplikacja mobilna do wspólnego prowadzenia list zakupów. Projekt jest rozwijany na Windowsie w React Native, Expo i TypeScript.

> Bieżący stan: profile, wiele gospodarstw na użytkownika, zaproszenia kodem, lista zakupów i synchronizacja Realtime są zaimplementowane. Po zastosowaniu wszystkich migracji możesz testować aplikację w Expo Go.

## Plan i struktura

Implementacja przebiega etapami: (1) fundament Expo, (2) Supabase i uwierzytelnianie, (3) gospodarstwo i zaproszenia, (4) pierwsza lista i produkty, (5) Realtime, (6) praca offline, (7) powiadomienia i dostępność, (8) EAS i TestFlight.

Docelowy podział kodu:

```text
src/
  app/                 # trasy Expo Router
  components/          # współdzielone komponenty
  features/            # auth, households, shopping-lists, shopping-items
  hooks/
  lib/                 # Supabase, query i storage
  localization/        # polski teraz, miejsce na kolejne języki
  schemas/
  services/
  stores/
  theme/
  types/
  utils/
supabase/
  migrations/
  functions/
tests/
```

Wraz z kolejnymi etapami foldery będą dodawane wtedy, gdy pojawi się ich działająca zawartość.

## Wymagane programy i konta

Do uruchomienia bieżącego etapu potrzebujesz:

- Windows 11,
- Node.js LTS i npm,
- Git,
- Visual Studio Code,
- iPhone z Expo Go zainstalowanym z App Store.

Konto Supabase jest potrzebne, aby uruchomić logowanie. Konto Expo/EAS oraz Apple Developer będą potrzebne do Development Build/wydań iOS, nie do uruchomienia w Expo Go. Ustalony iOS Bundle Identifier to `pl.naszezakupy.app`.

## Uruchomienie na Windowsie i iPhonie

W PowerShell przejdź do katalogu aplikacji:

```powershell
Set-Location 'C:\Vibe Coding\nasze-zakupy'
npm install
npx expo start
```

Zainstaluj Expo Go na iPhonie, podłącz telefon i komputer do tej samej sieci Wi-Fi, zeskanuj kod QR wyświetlony w terminalu i otwórz go w Expo Go. Jeśli sieć blokuje połączenia lokalne, uruchom `npx expo start --tunnel`.

Plik `.env` jest wymagany do połączenia z Supabase. Skopiuj `.env.example` do `.env`, uzupełnij Project URL i **Publishable key** (`sb_publishable_...`) i ponownie uruchom Expo. Starsze klucze `anon` i `service_role` są wycofywane przez Supabase do końca 2026 r. Publishable key jest przeznaczony do aplikacji mobilnej, może być widoczny w jej konfiguracji i sam w sobie nie zastępuje autoryzacji — dostęp do danych musi być zabezpieczony przez Supabase Auth oraz RLS. Klucz `sb_secret_...` (lub starszy `service_role`) pozostaje wyłącznie po stronie backendu i nigdy nie trafia do aplikacji.

## Konfiguracja Supabase

1. W Supabase Dashboard utwórz projekt i poczekaj na uruchomienie bazy.
2. W **Connect** skopiuj **Project URL** oraz **Publishable key** z prefiksem `sb_publishable_`. Nie używaj `sb_secret_...` ani `service_role`.
3. W PowerShell:

   ```powershell
   Set-Location 'C:\Vibe Coding\nasze-zakupy'
   Copy-Item .env.example .env
   notepad .env
   ```

   Uzupełnij `EXPO_PUBLIC_SUPABASE_URL` i `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Nie udostępniaj zawartości `.env`.

4. W **Authentication → Sign In / Providers → Email** włącz dostawcę e-mail i hasła. Potwierdzenie adresu e-mail pozostaw wyłączone, jeśli logujesz się istniejącymi kontami utworzonymi przez administratora. Użytkownicy aplikacji nie mogą samodzielnie zakładać kont.
5. W **Authentication → Users** administrator tworzy i zarządza kontami oraz hasłami. Do aplikacji wpisuje się dane jednego z istniejących użytkowników.
6. W **SQL Editor** otwórz i uruchom migrację [`202610270001_initial_auth_and_households.sql`](./supabase/migrations/202610270001_initial_auth_and_households.sql), jeśli nie była jeszcze wykonana. Tworzy profile, gospodarstwa, członkostwa, zaproszenia, listy, produkty, ustawienia, tokeny push, indeksy, triggery, polityki RLS i publikację Realtime dla list oraz produktów.
7. Jeśli pozostałe migracje nie były jeszcze uruchomione, wykonaj je w kolejności nazw w **SQL Editor**: `202610280001_household_invitation_and_active_list_rpcs.sql`, `202610280002_fix_ambiguous_household_id.sql`, `202610280003_make_shopping_item_quantity_unit_optional.sql`, [`202610280004_support_multiple_households.sql`](./supabase/migrations/202610280004_support_multiple_households.sql), [`202610280005_delete_household_rpc.sql`](./supabase/migrations/202610280005_delete_household_rpc.sql), [`202610280006_recipes.sql`](./supabase/migrations/202610280006_recipes.sql), [`202610280007_secure_household_invitations.sql`](./supabase/migrations/202610280007_secure_household_invitations.sql) [`202611050001_recipe_steps_and_deduplicate_shopping_items.sql`](./supabase/migrations/202611050001_recipe_steps_and_deduplicate_shopping_items.sql), [`202611050002_optional_recipe_step_duration_and_empty_shopping_lists.sql`](./supabase/migrations/202611050002_optional_recipe_step_duration_and_empty_shopping_lists.sql), [`202611050003_household_todo_items.sql`](./supabase/migrations/202611050003_household_todo_items.sql), [`202611050004_todo_item_assignees.sql`](./supabase/migrations/202611050004_todo_item_assignees.sql) i [`202611050005_update_shopping_item.sql`](./supabase/migrations/202611050005_update_shopping_item.sql), [`202611050006_expected_updated_at_for_item_updates.sql`](./supabase/migrations/202611050006_expected_updated_at_for_item_updates.sql) i [`202611050007_recipe_ingredients_merge_by_name_and_unit.sql`](./supabase/migrations/202611050007_recipe_ingredients_merge_by_name_and_unit.sql) i [`202611050008_merge_only_unpurchased_and_protect_owner_accounts.sql`](./supabase/migrations/202611050008_merge_only_unpurchased_and_protect_owner_accounts.sql). Migracja 004 dodaje bezpieczne RPC tworzenia gospodarstwa, dołączania i opuszczania oraz atomowo wymusza limit 3 członkostw. Migracja 005 dodaje trwałe usuwanie gospodarstwa przez właściciela z potwierdzeniem nazwy i odbiera bezpośrednie `DELETE` do `households`. Migracja 006 dodaje przepisy i składniki, ich polityki RLS, RPC zapisu i atomowego dodawania składników na aktywną listę oraz publikację Realtime. Migracja 007 odbiera bezpośrednie dodawanie zaproszeń i pozostawia je kontrolowanemu RPC. Migracja 008 dodaje uporządkowane punkty przygotowania oraz atomowe scalanie pasujących produktów z aktywnej listy. Polityki RLS pozostają włączone. Uruchom wyłącznie migracje, których nie ma jeszcze w bazie; nigdy nie uruchamiaj ponownie wykonanych migracji.
8. Uruchom Metro:

   ```powershell
   npx expo start
   ```

Logowanie używa istniejącego konta i hasła; nie wysyła wiadomości e-mail i nie wymaga konfiguracji redirect URLs.

## Test dwóch kont

1. Uruchom aplikację w Expo Go i zaloguj się pierwszym istniejącym kontem. Przy pierwszym logowaniu podaj nazwę wyświetlaną, a następnie utwórz gospodarstwo (domyślna nazwa to „Nasze Zakupy”).
2. Na ekranie listy w sekcji zaproszenia wpisz e-mail drugiego istniejącego konta. Wybierz **Utwórz kod zaproszenia**, a następnie udostępnij kod drugiej osobie. Kod działa przez 7 dni i jest powiązany z wpisanym adresem e-mail.
3. Na drugim iPhonie albo po wylogowaniu zaloguj się drugim istniejącym kontem. Ustaw nazwę wyświetlaną, wybierz **Dołącz do gospodarstwa** i wklej otrzymany kod.
4. Po dołączeniu drugie konto otworzy tę samą listę. Dodaj produkt na jednym telefonie; powinien pojawić się na drugim bez ręcznego odświeżania. Zaznaczenie, cofnięcie i usunięcie produktu również synchronizują się na żywo.
5. Z listy zakupów otwórz **Gospodarstwa**, a następnie **Lista gospodarstw**, aby przełączyć gospodarstwo lub zarządzać nim. Każde konto może należeć maksymalnie do 3 gospodarstw. Członek może opuścić gospodarstwo; dane pozostają dla pozostałych. Właściciel nie może opuścić go, dopóki nie zostanie dodany mechanizm przekazywania własności.
6. Właściciel może trwale usunąć gospodarstwo z jego strony szczegółów. Operacja wymaga potwierdzenia w dwóch krokach, w tym wpisania aktualnej nazwy. Usunięcie kasuje członkostwa, zaproszenia, listy i produkty przez istniejące kaskady FK; nie usuwa kont ani profili. Zaproszenia są dostępne z **Gospodarstwa → Zaproszenia do gospodarstwa** i mogą być tworzone przez właściciela wybranego gospodarstwa.
7. Na liście zakupów otwórz **Przepisy**, aby zobaczyć przepisy aktywnego gospodarstwa, utworzyć przepis lub otworzyć jego szczegóły. Składniki można edytować i klasyfikowane są automatycznie; kategorię można również wybrać ręcznie. Formularz obsługuje opis i uporządkowane punkty przygotowania. Akcja **Dodaj wszystko do listy** pyta o potwierdzenie, nie tworzy duplikatów i dodaje ilości tylko wtedy, gdy można je bezpiecznie połączyć. Przed użyciem pełnego modułu przepisów uruchom migracje `202610280006_recipes.sql` oraz `202611050001_recipe_steps_and_deduplicate_shopping_items.sql`.

Kod zaproszenia jest jednorazowym sekretem dostępu do członkostwa, a nie metodą logowania. Jest generowany i sprawdzany po stronie bazy; zapisywany w tabeli jest wyłącznie jego SHA-256. Aplikacja nie wysyła e-maili i nie przechowuje kodu po opuszczeniu ekranu.

Migracja początkowa dodaje `shopping_lists` i `shopping_items` do publikacji `supabase_realtime`. Jeśli aplikacja pokazuje błąd synchronizacji, w Dashboardzie sprawdź **Database → Publications → supabase_realtime** i potwierdź, że publikacja zawiera `public.shopping_items`. Jeśli jej brakuje, dodaj tę tabelę w panelu lub w SQL Editor wykonaj:

```sql
alter publication supabase_realtime add table public.shopping_items;
```

Migrację sprawdziłem w tymczasowej instancji PostgreSQL: tworzenie profilu/ustawień po rejestracji działa, a drugi użytkownik nie może odczytać danych obcego gospodarstwa, dopisać produktu do jego listy ani odczytać `token_hash` zaproszenia. Test nie zmienia projektu Supabase. Końcowy blok migracji dopisuje listy i produkty do publikacji `supabase_realtime` w zarządzanym Supabase.

## Kontrole jakości

```powershell
npm run typecheck
npm run lint
npm test
npm run format:check
```

## Expo Go i Development Build

Bieżący szkielet korzysta z Expo SDK 58 i Expo Router, które są dostępne w Expo Go. Pełne zdalne powiadomienia, niestandardowa konfiguracja natywna i weryfikacja uprawnień urządzenia będą wymagać Development Build na fizycznym iPhonie. Budowanie iOS przez EAS działa w chmurze, więc nie wymaga komputera Mac; publikacja przez TestFlight wymaga członkostwa Apple Developer.

## Znane ograniczenia bieżącego etapu

- Wymagane jest wykonanie powyższych kroków w panelu Supabase i lokalne uzupełnienie `.env`; bez nich aplikacja pokaże komunikat konfiguracji zamiast logować użytkownika.
- Do EAS Cloud Build ustaw w środowisku `production` zmienne `EXPO_PUBLIC_SUPABASE_URL` i `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Są to wartości publiczne wbudowywane do aplikacji; nie używaj klucza `service_role` ani `sb_secret_`.
- Ikona iOS, adaptive icon oraz splash korzystają z finalnej grafiki `assets/images/icon.png`; tło splashu jest ciemnozielone.
- Zaproszenie jest przekazywane ręcznie przez systemowy arkusz udostępniania; automatyczna wysyłka e-mail i zarządzanie wieloma listami nie są jeszcze dostępne.
- Usuwanie konta i inne operacje administracyjne wymagające klucza serwerowego nie są dostępne z klienta.
- Ceny produktów, trwała kolejka offline, powiadomienia push i zarządzanie wieloma listami zakupów w obrębie gospodarstwa nie zostały jeszcze zaimplementowane.
- Profile EAS są przygotowane, a projekt ma zapisany EAS project ID. Przed buildem w chmurze skonfiguruj dla profilu `production` zmienne `EXPO_PUBLIC_SUPABASE_URL` i `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` w środowisku EAS. Wartość zdalnego iOS build number nie została sprawdzona.
- `npm audit` nadal zgłasza podatności w grafie zależności narzędziowych Expo/Jest. Nie uruchamiaj `npm audit fix --force`, ponieważ proponuje niezgodną wersję Expo poza aktualnym SDK. Ponownie oceń alerty po wydaniu bezpiecznej poprawki zgodnej z SDK.

## Decyzje architektoniczne

- Projekt używa Expo SDK 58 i Expo Router.
- Expo Router i TypeScript strict są skonfigurowane od początku.
- Interfejs startowy ma obsługę jasnego i ciemnego wyglądu oraz polskie teksty wydzielone do lokalizacji.
- iOS Bundle Identifier to `pl.naszezakupy.app`.
- Klucze Supabase i sekrety nie są przechowywane w repozytorium.

## Zgłoszenie problemu

Przed zgłoszeniem problemu uruchom `npm run typecheck`, `npm run lint` i `npm test`, a następnie dołącz komunikat błędu bez tokenów ani prywatnych danych.
