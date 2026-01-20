# Secure Messenger Frontend

Frontend aplikacji Secure Messenger w Angular 18+.

## Instalacja

```bash
npm install
```

## Uruchomienie

```bash
npm start
```

Aplikacja będzie dostępna pod adresem `http://localhost:4200`.

## Uruchamianie w całej sieci:

uv run uvicorn app.main:app --host 0.0.0.0 --port 8000

## Technologie

- Angular 18+
- TypeScript
- RxJS
- Web Crypto API

## Funkcjonalności

- Rejestracja i logowanie użytkowników
- Dwuetapowa weryfikacja (2FA TOTP)
- Wysyłanie zaszyfrowanych wiadomości
- Szyfrowanie hybrydowe (RSA + AES-256-GCM)
- Podpis cyfrowy wiadomości (RSA-PSS)
- Załączniki do wiadomości
- Weryfikacja autentyczności wiadomości
