# Clinical Frontend

Frontend inicial minimalista e intuitivo separado del backend.

## Objetivo

- Registrar onboarding de paciente
- Crear citas
- Enviar consentimiento informado
- Manejar flags de canal SMS/Email a nivel UI

## Uso local

1. Levanta el backend (SAM local o API desplegada).
2. Guarda la URL de API en localStorage:

```js
localStorage.setItem("clinical_api", "https://tu-api.execute-api.us-east-1.amazonaws.com")
```

3. Abre `index.html` con Live Server o cualquier servidor estático.

## Nota

Este frontend es base MVP. El siguiente paso recomendado es migrarlo a React/Next.js con autenticación (Cognito) y calendario visual por doctor.


## Comando para levantar local

```python3 -m http.server 5173```

http://127.0.0.1:5173