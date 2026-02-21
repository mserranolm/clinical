#!/bin/bash
# Limpia todas las tablas DynamoDB. Queda la BD vacía.
# Después debes crear de nuevo el super usuario con POST /platform/bootstrap (ver abajo).
set -e

PROFILE="${AWS_PROFILE:-aski}"
REGION="${AWS_REGION:-us-east-1}"
TABLES=(
  "clinical-users"
  "clinical-appointments"
  "clinical-patients"
  "clinical-consents"
  "clinical-consent-templates"
  "clinical-odontograms"
  "clinical-treatment-plans"
)

echo "=== Limpiando todas las tablas DynamoDB (perfil: $PROFILE, región: $REGION) ==="

for TABLE in "${TABLES[@]}"; do
  echo "→ $TABLE ..."
  ITEMS=$(aws dynamodb scan \
    --table-name "$TABLE" \
    --attributes-to-get PK SK \
    --query "Items" \
    --output json \
    --profile "$PROFILE" \
    --region "$REGION")

  COUNT=$(echo "$ITEMS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 0)")
  echo "  $COUNT ítems"

  if [ "$COUNT" -gt 0 ]; then
    echo "$ITEMS" | python3 -c "
import sys, json, subprocess
TABLE = '''$TABLE'''
PROFILE = '''$PROFILE'''
REGION = '''$REGION'''
items = json.load(sys.stdin)
for i in range(0, len(items), 25):
    batch = items[i:i+25]
    requests = [{'DeleteRequest': {'Key': {'PK': item['PK'], 'SK': item['SK']}}} for item in batch]
    payload = json.dumps({TABLE: requests})
    result = subprocess.run(
        ['aws', 'dynamodb', 'batch-write-item', '--request-items', payload, '--profile', PROFILE, '--region', REGION],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print('ERROR:', result.stderr, file=sys.stderr)
    else:
        print(f'  Eliminados {len(batch)}')
"
  fi
  echo "  ✓ $TABLE limpiada"
done

echo ""
echo "=== BD limpiada. Solo queda vacía. ==="
echo ""
echo "Para crear de nuevo el SUPER USUARIO (platform admin):"
echo "  1. En el backend configura BOOTSTRAP_SECRET (ej. en .env.local o template.yaml)."
echo "  2. Llama a la API:"
echo "     POST /platform/bootstrap"
echo "     Body: {\"secret\": \"<BOOTSTRAP_SECRET>\", \"email\": \"tu@email.com\", \"name\": \"Admin\", \"password\": \"tu_password_seguro\"}"
echo "  3. Con ese usuario (email + password) puedes entrar en la app y crear organizaciones/usuarios desde cero."
echo ""
